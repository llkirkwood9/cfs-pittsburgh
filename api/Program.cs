using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using api.Data;
using api.Services;
using api.Utils;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Config layering: base -> local secrets -> environment overlay -> local environment overlay
// -> environment variables -> command line. Later sources win.
//
// Clearing the sources also drops the host's ASPNETCORE_-prefixed environment provider, which is
// where Kestrel reads ASPNETCORE_HTTP_PORTS / ASPNETCORE_URLS from. It is added back first so a
// container can still choose the port; without it Kestrel falls back to localhost:5000 and is
// unreachable from outside the container.
builder.Configuration.Sources.Clear();
builder.Configuration
    .SetBasePath(builder.Environment.ContentRootPath)
    .AddEnvironmentVariables(prefix: "ASPNETCORE_")
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"appsettings.local.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables()
    .AddCommandLine(args);

// No "Server: Kestrel" header telling the world what to aim at.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// Outside development, refuse to start on settings that would leave the app open: a missing or
// placeholder signing key would let anyone who has read this repository forge a sign-in.
if (!builder.Environment.IsDevelopment())
{
    var jwtKey = builder.Configuration["Jwt:Key"] ?? string.Empty;
    if (Encoding.UTF8.GetByteCount(jwtKey) < 32
        || jwtKey.Contains("REPLACE", StringComparison.OrdinalIgnoreCase)
        || jwtKey.Contains("CHANGE_THIS", StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException(
            "Jwt:Key must be set to a random secret of at least 32 characters (Jwt__Key in the environment).");

    if (string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("DefaultConnection")))
        throw new InvalidOperationException(
            "ConnectionStrings:DefaultConnection must be set (ConnectionStrings__DefaultConnection in the environment).");
}

// SQL Server on a Windows or x86 box, PostgreSQL where SQL Server cannot run - a Raspberry Pi,
// or a managed cloud database. Set Database__Provider=Postgres (or CFS_DB_PROVIDER) alongside the
// connection string.
var dbProvider = builder.Configuration["Database:Provider"]
                 ?? builder.Configuration["CFS_DB_PROVIDER"]
                 ?? "SqlServer";
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

if (dbProvider.Equals("Postgres", StringComparison.OrdinalIgnoreCase)
    || dbProvider.Equals("PostgreSql", StringComparison.OrdinalIgnoreCase))
{
    // Dates are stored the way SQL Server stores them - a plain date and time with no timezone -
    // so Npgsql is told to use "timestamp without time zone" columns and accept them as they are.
    // Without this it insists every DateTime is UTC and refuses an event date read from the seed.
    AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

    builder.Services.AddDbContext<PostgresDbContext>(options => options.UseNpgsql(connectionString));
    builder.Services.AddScoped<ApplicationDbContext>(sp => sp.GetRequiredService<PostgresDbContext>());
}
else
{
    builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));
}

builder.Services.AddHttpClient();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<EmailService>();

// Behind a cloud load balancer the API sees the balancer's address and plain HTTP. The forwarded
// headers give back the visitor's address (for rate limiting and lockout logs) and the original
// scheme (for secure cookies and HSTS). Only the right-most hop is believed - the one the balancer
// itself added - so a visitor can't pose as another address by sending their own header.
// ForwardedHeaders__ForwardLimit raises that for a chain of proxies; ForwardedHeaders__Enabled=false
// turns it off for a server reached directly.
var trustForwarded = !string.Equals(builder.Configuration["ForwardedHeaders:Enabled"], "false", StringComparison.OrdinalIgnoreCase);
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = int.TryParse(builder.Configuration["ForwardedHeaders:ForwardLimit"], out var hops)
        ? Math.Clamp(hops, 1, 5)
        : 1;
    // A container host's balancer address isn't known in advance.
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = false;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        // The deployed app serves its own dashboard from the same origin, so outside development
        // no other site is let in unless Cors:AllowedOrigins names it.
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                      ?? (builder.Environment.IsDevelopment() ? ["http://localhost:3000"] : []);

        policy.WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer("Bearer", options =>
{
    var key = builder.Configuration["Jwt:Key"]
              ?? throw new InvalidOperationException("Jwt:Key is not configured.");

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        ClockSkew = TimeSpan.FromMinutes(1),
    };
});

builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // A busy cart runs several tablets against one API; the window is generous enough for a rep
    // typing quickly but still caps a runaway client. Signed-in users are counted by account,
    // everyone else by address.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } userId
                ? $"user:{userId}"
                : $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromSeconds(10),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 20,
            }));

    // Signing in, renewing and signing out: per address, on top of the per-account lockout, to slow
    // password guessing across many accounts. A venue's tablets share one address, so it still
    // allows a whole crew signing in at once.
    options.AddPolicy(RateLimits.SignIn, context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0,
            }));
});

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (trustForwarded)
    app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();
else
    app.UseHsts();

// Browser hardening on every response. The dashboard draws sales sheets and signatures onto
// canvases (data: and blob: images), previews the receipt email in a sandboxed frame, and loads
// nothing from anywhere else.
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "SAMEORIGIN";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";
    headers["Cross-Origin-Opener-Policy"] = "same-origin";
    headers["Content-Security-Policy"] =
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https:; " +
        "font-src 'self' data:; " +
        "connect-src 'self'; " +
        "frame-src 'self' blob:; " +
        "worker-src 'self' blob:; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "frame-ancestors 'self'";
    await next();
});

// In the Docker image the built dashboard sits in wwwroot and the API serves it, so the whole app
// is one origin on one port. In local development there is no wwwroot and Vite serves it instead.
var hostsDashboard = app.Environment.WebRootPath != null
                     && File.Exists(Path.Combine(app.Environment.WebRootPath, "index.html"));

if (hostsDashboard)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

// Routing is placed explicitly after the static files. Left implicit, it runs first, the dashboard
// fallback below claims every request, and the static file middleware then skips them all - so the
// browser would get index.html back for its JavaScript and CSS.
app.UseRouting();

app.UseCors("AllowReactApp");
app.UseAuthentication();
app.UseRateLimiter();
// Who is asking and which territory they may see, checked against the database on every request
// so a switched-off account or territory stops working straight away.
app.UseMiddleware<AccessScopeMiddleware>();
app.UseAuthorization();
app.MapControllers();

app.MapGet("/health", () => "Healthy").AllowAnonymous();
app.MapGet("/version", (IConfiguration config) =>
    Results.Ok(new { Version = config["ApiInfo:Version"] ?? "0.0.0" })).AllowAnonymous();

// Any path that is not an API call or a real file is a dashboard route, so hand it index.html and
// let the React router take over. API paths are excluded so a mistyped endpoint still 404s.
if (hostsDashboard)
    app.MapFallbackToFile("{**path:regex(^(?!api/).*$)}", "index.html");

// Apply migrations and seed the catalog from the CFS price cards on first run.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var tokenService = scope.ServiceProvider.GetRequiredService<TokenService>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    // The database can still be starting when the API comes up (SQL Server shares the container in
    // the Docker image; a managed database may be waking), so give it a minute before giving up.
    var attempts = int.TryParse(builder.Configuration["Startup:DatabaseAttempts"], out var configured)
        ? Math.Max(1, configured)
        : 12;

    for (var attempt = 1; attempt <= attempts; attempt++)
    {
        try
        {
            await db.Database.MigrateAsync();

            // SKIP_SEED_DATA in the Docker .env (Seed:Skip) leaves out the sample catalog,
            // delivery options and event.
            var skipSeed = builder.Configuration["Seed:Skip"]?.Trim().ToLowerInvariant() is "true" or "1" or "yes";
            var generated = await api.Data.SeedData.SeedAsync(
                db, tokenService, builder.Configuration["Seed:AdminPassword"], accountsOnly: skipSeed);
            if (skipSeed && attempt == 1)
                logger.LogWarning("Seed:Skip is set, so the sample catalog, delivery options and event were not loaded.");

            // Only ever written once, when the first account is created on an empty database, and it
            // has to be changed at first sign-in.
            if (generated != null)
                logger.LogWarning(
                    "Created the first account. Username: admin  Temporary password: {Password}  (it must be changed at first sign-in)",
                    generated);

            var promoted = await api.Data.SeedData.EnsureOwnerAsync(db);
            if (promoted != null)
                logger.LogWarning("No owner account existed, so {Username} is now the owner.", promoted);
            break;
        }
        catch (Exception e) when (attempt < attempts)
        {
            logger.LogWarning("Database not ready (attempt {Attempt}/{Attempts}): {Message}",
                attempt, attempts, e.Message);
            await Task.Delay(TimeSpan.FromSeconds(5));
        }
        catch (Exception e)
        {
            logger.LogCritical("Startup migration or seed failed: {Message}", e.Message);
        }
    }
}

app.Run();
