using System.Text;
using System.Threading.RateLimiting;
using api.Data;
using api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpClient();
builder.Services.AddSingleton<TokenService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                      ?? new[] { "http://localhost:3000" };

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
        ClockSkew = TimeSpan.FromMinutes(1),
    };
});

builder.Services.AddAuthorization();

// A busy cart runs several tablets against one API; the window is generous enough for a rep
// typing quickly but still caps a runaway client.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.Identity?.Name
                          ?? context.Connection.RemoteIpAddress?.ToString()
                          ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromSeconds(10),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 20,
            }));
});

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

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
app.UseRateLimiter();
app.UseAuthentication();
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

    // SQL Server can still be starting when the API comes up (it shares the container in the
    // Docker image), so give it a minute before giving up.
    var attempts = int.TryParse(builder.Configuration["Startup:DatabaseAttempts"], out var configured)
        ? Math.Max(1, configured)
        : 12;

    for (var attempt = 1; attempt <= attempts; attempt++)
    {
        try
        {
            await db.Database.MigrateAsync();
            await api.Data.SeedData.SeedAsync(db, tokenService);
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
