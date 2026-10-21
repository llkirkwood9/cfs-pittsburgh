using System.Diagnostics;
using api.Data;
using api.Dtos.Authentication;
using api.Models;
using api.Services;
using api.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    /// <summary>
    /// Sign-in, session renewal, password changes and sign-out.
    ///
    /// The access token is short-lived and kept only in the dashboard's memory. The refresh token
    /// travels in an httpOnly, SameSite=Strict cookie scoped to /api/auth, so page scripts can't
    /// read it and other sites can't send it; the database keeps only its SHA-256 hash. Renewal
    /// and sign-out also require the X-CFS-Client header, which a cross-site form can't add.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting(RateLimits.SignIn)]
    public class AuthController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region Private Fields

        /// <summary>The refresh cookie's name.</summary>
        public const string RefreshCookie = "cfs_refresh";

        /// <summary>The header renewal and sign-out require, as a cross-site request guard.</summary>
        public const string ClientHeader = "X-CFS-Client";

        /// <summary>
        /// The client header's value from the phone app. A native app has no browser cookie jar to
        /// hide the refresh token in, so it gets the token in the response body, keeps it in the
        /// phone's secure storage (Keychain / Keystore) and sends it back in RefreshHeader.
        /// </summary>
        public const string AppClient = "app";

        /// <summary>The header the phone app sends its refresh token in.</summary>
        public const string RefreshHeader = "X-Refresh-Token";

        private const string WrongPassword = "Incorrect username or password.";

        #endregion

        #region POST Methods

        /// <summary>
        /// Signs a crew member in with their username and password. Too many wrong passwords in a
        /// row lock the account for a while. An account from before passwords may sign in once with
        /// its old PIN, and must then choose a password.
        /// </summary>
        /// <param name="request">Username and password</param>
        /// <returns>An access token and the user; the refresh token is set as a cookie.</returns>
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password))
                    return BadRequest(new { error = "Enter your username and password." });

                if (request.Username.Length > 50 || request.Password.Length > PasswordPolicy.MaxLength)
                    return Unauthorized(new { error = WrongPassword });

                // Usernames are matched without regard to case on every database.
                var username = request.Username.Trim().ToLower();
                var user = await DB.Users
                    .Include(u => u.Territory)
                    .FirstOrDefaultAsync(u => u.Username.ToLower() == username);

                if (user == null || !user.IsActive)
                {
                    // Spend the same time hashing as a real check, so response times don't reveal
                    // which usernames exist.
                    TokenService.VerifyPassword(new User { PasswordHash = DummyHash }, request.Password, out _);
                    return Unauthorized(new { error = WrongPassword });
                }

                if (user.LockoutUntil > DateTime.UtcNow)
                {
                    var minutes = (int)Math.Ceiling((user.LockoutUntil.Value - DateTime.UtcNow).TotalMinutes);
                    return StatusCode(429, new { error = $"Too many wrong passwords. Try again in {minutes} minute{(minutes == 1 ? "" : "s")}, or ask a manager to reset your password." });
                }

                var matched = TokenService.VerifyPassword(user, request.Password, out var rehash);
                var viaOldPin = false;
                if (!matched && user.PasswordHash == null && AllowLegacyPins())
                {
                    matched = TokenService.VerifyLegacyPin(request.Password, user.PinSalt, user.PinHash);
                    viaOldPin = matched;
                }

                if (!matched)
                {
                    user.FailedLoginCount++;
                    if (user.FailedLoginCount >= MaxFailedAttempts())
                    {
                        user.LockoutUntil = DateTime.UtcNow.AddMinutes(LockoutMinutes());
                        user.FailedLoginCount = 0;
                        Trace(TraceEventType.Warning, $"Account {user.Username} locked after repeated wrong passwords.");
                    }
                    await DB.SaveChangesAsync();
                    return Unauthorized(new { error = WrongPassword });
                }

                if (user.Territory is { IsActive: false })
                    return StatusCode(403, new { error = "Your territory has been switched off. Ask an administrator." });

                user.FailedLoginCount = 0;
                user.LockoutUntil = null;
                user.LastLoginAt = DateTime.UtcNow;
                if (rehash)
                    user.PasswordHash = TokenService.HashPassword(user, request.Password);
                // A PIN is far too easy to guess on the open internet: it gets one use, to set a password.
                if (viaOldPin)
                    user.MustChangePassword = true;

                var refreshToken = await OpenSessionAsync(user);
                await DB.SaveChangesAsync();

                return Issue(user, refreshToken);
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while signing in.", e);
            }
        }

        /// <summary>
        /// Renews the session from the refresh cookie, rotating it, and returns a new access token.
        /// </summary>
        /// <returns>An access token and the user.</returns>
        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh()
        {
            try
            {
                if (!Request.Headers.ContainsKey(ClientHeader))
                    return BadRequest(new { error = "Missing client header." });

                var token = IncomingRefreshToken();
                if (string.IsNullOrEmpty(token))
                    return Unauthorized(new { error = "Please sign in." });

                var hash = TokenService.HashRefreshToken(token);
                var session = await DB.UserSessions
                    .Include(s => s.User)
                    .ThenInclude(u => u!.Territory)
                    .FirstOrDefaultAsync(s => s.TokenHash == hash);

                var user = session?.User;
                if (session == null || user == null || session.ExpiresAt < DateTime.UtcNow
                    || !user.IsActive || user.Territory is { IsActive: false })
                {
                    if (session != null)
                    {
                        DB.UserSessions.Remove(session);
                        await DB.SaveChangesAsync();
                    }
                    ClearRefreshCookie();
                    return Unauthorized(new { error = "Session expired. Please sign in again." });
                }

                // Each refresh token works once; the next one replaces it.
                var next = TokenService.CreateRefreshToken();
                session.TokenHash = TokenService.HashRefreshToken(next);
                session.ExpiresAt = TokenService.GetRefreshTokenExpiry();
                session.LastUsedAt = DateTime.UtcNow;
                await DB.SaveChangesAsync();

                return Issue(user, next);
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while refreshing the session.", e);
            }
        }

        /// <summary>
        /// Lets the signed-in user change their own password. They have to give the current one
        /// first, so a tablet left signed in can't be used to lock someone out. Every other signed-in
        /// device is signed out.
        /// </summary>
        /// <param name="request">Current and new password</param>
        /// <returns>The updated profile.</returns>
        [HttpPost("change-password")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto request)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { error = "Not signed in." });

                if (string.IsNullOrEmpty(request.CurrentPassword) || string.IsNullOrEmpty(request.NewPassword))
                    return BadRequest(new { error = "Enter your current password and a new one." });

                var user = await DB.Users.Include(u => u.Territory).FirstOrDefaultAsync(u => u.Id == userId.Value);
                if (user == null || !user.IsActive)
                    return NotFound(new { error = "User not found." });

                var current = TokenService.VerifyPassword(user, request.CurrentPassword, out _)
                              || (user.PasswordHash == null && TokenService.VerifyLegacyPin(request.CurrentPassword, user.PinSalt, user.PinHash));
                if (!current)
                    return BadRequest(new { error = "Your current password is not right." });

                if (request.NewPassword == request.CurrentPassword)
                    return BadRequest(new { error = "The new password is the same as the current one." });

                var problem = PasswordPolicy.Check(request.NewPassword, user.Username, user.Name);
                if (problem != null)
                    return BadRequest(new { error = problem });

                Passwords.Set(TokenService, user, request.NewPassword, mustChange: false);

                // Keep this device signed in; sign every other one out.
                var keep = IncomingRefreshToken() is { Length: > 0 } thisDevice ? TokenService.HashRefreshToken(thisDevice) : "";
                await DB.UserSessions.Where(s => s.UserId == user.Id && s.TokenHash != keep).ExecuteDeleteAsync();
                await DB.SaveChangesAsync();

                Trace(TraceEventType.Information, $"{user.Username} changed their password.");
                return Ok(UserMapper.ToDto(user));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while changing the password.", e);
            }
        }

        /// <summary>
        /// Signs this device out: ends its session and clears the cookie. Works even after the
        /// access token has expired.
        /// </summary>
        /// <returns>200.</returns>
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            try
            {
                if (!Request.Headers.ContainsKey(ClientHeader))
                    return BadRequest(new { error = "Missing client header." });

                var token = IncomingRefreshToken();
                if (!string.IsNullOrEmpty(token))
                {
                    var hash = TokenService.HashRefreshToken(token);
                    await DB.UserSessions.Where(s => s.TokenHash == hash).ExecuteDeleteAsync();
                }

                ClearRefreshCookie();
                return Ok();
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while signing out.", e);
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Returns the profile of the signed-in user.
        /// </summary>
        /// <returns>The user profile.</returns>
        [HttpGet("me")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetCurrentUser()
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { error = "Not signed in." });

                var user = await DB.Users.Include(u => u.Territory).AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
                if (user == null || !user.IsActive)
                    return NotFound(new { error = "User not found." });

                return Ok(UserMapper.ToDto(user));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while loading the profile.", e);
            }
        }

        /// <summary>
        /// The password rules, for the screens that ask for one.
        /// </summary>
        /// <returns>The minimum length and the rule in words.</returns>
        [HttpGet("password-policy")]
        public IActionResult GetPasswordPolicy()
        {
            return Ok(new { minLength = PasswordPolicy.MinLength, maxLength = PasswordPolicy.MaxLength, description = PasswordPolicy.Description });
        }

        #endregion

        #region Private Methods

        /// <summary>A real hash of a random password, checked against when the username doesn't exist.</summary>
        private static readonly string DummyHash = new Microsoft.AspNetCore.Identity.PasswordHasher<User>()
            .HashPassword(new User(), TokenService.GeneratePassword());

        private AuthResponseDto Respond(User user) => new()
        {
            AccessToken = TokenService.CreateAccessToken(user),
            ExpiresIn = TokenService.AccessTokenMinutes() * 60,
            User = UserMapper.ToDto(user),
        };

        /// <summary>Whether the request comes from the phone app rather than the dashboard.</summary>
        private bool IsApp() =>
            string.Equals(Request.Headers[ClientHeader].ToString(), AppClient, StringComparison.OrdinalIgnoreCase);

        /// <summary>
        /// The refresh token the request carries: the phone app's header, or the dashboard's cookie.
        /// </summary>
        private string? IncomingRefreshToken()
        {
            if (!IsApp()) return Request.Cookies[RefreshCookie];
            var token = Request.Headers[RefreshHeader].ToString();
            return string.IsNullOrEmpty(token) ? null : token;
        }

        /// <summary>
        /// Answers a sign-in or refresh: the dashboard gets the refresh token as its httpOnly cookie,
        /// the phone app in the body.
        /// </summary>
        private IActionResult Issue(User user, string refreshToken)
        {
            var response = Respond(user);
            if (IsApp())
                response.RefreshToken = refreshToken;
            else
                SetRefreshCookie(refreshToken);
            return Ok(response);
        }

        /// <summary>Opens a session for this device and returns its refresh token.</summary>
        private async Task<string> OpenSessionAsync(User user)
        {
            // Sessions that have run out are tidied up as people sign in.
            await DB.UserSessions.Where(s => s.UserId == user.Id && s.ExpiresAt < DateTime.UtcNow).ExecuteDeleteAsync();

            var token = TokenService.CreateRefreshToken();
            var agent = Request.Headers.UserAgent.ToString();
            DB.UserSessions.Add(new UserSession
            {
                UserId = user.Id,
                TokenHash = TokenService.HashRefreshToken(token),
                ExpiresAt = TokenService.GetRefreshTokenExpiry(),
                UserAgent = agent.Length > 200 ? agent[..200] : agent,
            });
            return token;
        }

        private void SetRefreshCookie(string token)
        {
            Response.Cookies.Append(RefreshCookie, token, new CookieOptions
            {
                HttpOnly = true,
                Secure = SecureCookies(),
                SameSite = SameSiteMode.Strict,
                Path = "/api/auth",
                Expires = TokenService.GetRefreshTokenExpiry(),
                IsEssential = true,
            });
        }

        private void ClearRefreshCookie()
        {
            Response.Cookies.Delete(RefreshCookie, new CookieOptions
            {
                HttpOnly = true,
                Secure = SecureCookies(),
                SameSite = SameSiteMode.Strict,
                Path = "/api/auth",
            });
        }

        /// <summary>
        /// Whether the session cookie is HTTPS-only. Auth:SecureCookies true or false forces it;
        /// left unset it follows the request, so a cloud host behind HTTPS always gets a secure
        /// cookie while a cart's Pi on plain HTTP still works.
        /// </summary>
        private bool SecureCookies() => Config["Auth:SecureCookies"]?.Trim().ToLowerInvariant() switch
        {
            "true" => true,
            "false" => false,
            _ => Request.IsHttps,
        };

        private bool AllowLegacyPins() => !string.Equals(Config["Auth:AllowLegacyPins"], "false", StringComparison.OrdinalIgnoreCase);

        private int MaxFailedAttempts() => int.TryParse(Config["Auth:MaxFailedAttempts"], out var n) ? Math.Clamp(n, 3, 20) : 5;

        private int LockoutMinutes() => int.TryParse(Config["Auth:LockoutMinutes"], out var n) ? Math.Clamp(n, 1, 1440) : 15;

        #endregion
    }
}
