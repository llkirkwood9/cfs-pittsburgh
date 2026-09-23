using System.Diagnostics;
using api.Data;
using api.Dtos.Authentication;
using api.Models;
using api.Services;
using api.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    /// <summary>
    /// Sign-in, token refresh and sign-out for the crew tablets.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region POST Methods

        /// <summary>
        /// Signs a crew member in with their handle and PIN.
        /// </summary>
        /// <param name="request">Username and PIN</param>
        /// <returns>A token pair and the user profile.</returns>
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Pin))
                    return BadRequest(new { error = "Missing parameter." });

                // Usernames are matched without regard to case on every database.
                var username = request.Username.Trim().ToLower();
                var user = await DB.Users
                    .FirstOrDefaultAsync(u => u.Username.ToLower() == username && u.IsActive);

                // Same response for an unknown handle and a bad PIN so the screen cannot be used
                // to enumerate accounts.
                if (user == null || !TokenService.VerifyPin(request.Pin, user.PinSalt, user.PinHash))
                    return Unauthorized(new { error = "Incorrect username or PIN." });

                var accessToken = TokenService.CreateAccessToken(user);
                var refreshToken = TokenService.CreateRefreshToken();

                user.RefreshToken = refreshToken;
                user.RefreshTokenExpiry = TokenService.GetRefreshTokenExpiry();
                await DB.SaveChangesAsync();

                return Ok(new AuthResponseDto
                {
                    AccessToken = accessToken,
                    RefreshToken = refreshToken,
                    User = ToDto(user),
                });
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while signing in.", exception = e.Message });
            }
        }

        /// <summary>
        /// Exchanges a refresh token for a new token pair.
        /// </summary>
        /// <param name="request">The current refresh token</param>
        /// <returns>A new token pair and the user profile.</returns>
        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh([FromBody] RefreshDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.RefreshToken))
                    return BadRequest(new { error = "Missing parameter." });

                var user = await DB.Users
                    .FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken && u.IsActive);

                if (user == null || user.RefreshTokenExpiry == null || user.RefreshTokenExpiry < DateTime.UtcNow)
                    return Unauthorized(new { error = "Session expired. Please sign in again." });

                var accessToken = TokenService.CreateAccessToken(user);
                var refreshToken = TokenService.CreateRefreshToken();

                user.RefreshToken = refreshToken;
                user.RefreshTokenExpiry = TokenService.GetRefreshTokenExpiry();
                await DB.SaveChangesAsync();

                return Ok(new AuthResponseDto
                {
                    AccessToken = accessToken,
                    RefreshToken = refreshToken,
                    User = ToDto(user),
                });
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while refreshing the session.", exception = e.Message });
            }
        }

        /// <summary>
        /// Signs the current user out by clearing their refresh token.
        /// </summary>
        /// <returns>200 when the session was cleared.</returns>
        [HttpPost("logout")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> Logout()
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { error = "Not signed in." });

                var user = await DB.Users.FindAsync(userId.Value);
                if (user == null)
                    return NotFound(new { error = "User not found." });

                user.RefreshToken = null;
                user.RefreshTokenExpiry = null;
                await DB.SaveChangesAsync();

                return Ok();
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while signing out.", exception = e.Message });
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

                var user = await DB.Users.FindAsync(userId.Value);
                if (user == null || !user.IsActive)
                    return NotFound(new { error = "User not found." });

                return Ok(ToDto(user));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while loading the profile.", exception = e.Message });
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Maps a user entity to its DTO, never including the PIN.
        /// </summary>
        /// <param name="user">User entity</param>
        /// <returns>The mapped DTO.</returns>
        private static UserDto ToDto(User user)
        {
            return new UserDto
            {
                Id = user.Id,
                Name = user.Name,
                Username = user.Username,
                Email = user.Email,
                Role = user.Role.ToString(),
                IsActive = user.IsActive,
            };
        }

        #endregion
    }
}
