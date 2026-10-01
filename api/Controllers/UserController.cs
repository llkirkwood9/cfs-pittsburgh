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
    /// Administration of the crew accounts that sign in on the tablets.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class UserController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region POST Methods

        /// <summary>
        /// Adds a crew account.
        /// </summary>
        /// <param name="request">Name, username, PIN and role</param>
        /// <returns>The created user.</returns>
        [HttpPost("user")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddUser([FromBody] UserDto request)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = "Only an administrator may manage crew accounts." });

                if (string.IsNullOrWhiteSpace(request.Name) ||
                    string.IsNullOrWhiteSpace(request.Username) ||
                    string.IsNullOrWhiteSpace(request.Pin))
                    return BadRequest(new { error = "Missing parameter." });

                var newUsername = request.Username.Trim().ToLower();
                if (await DB.Users.AnyAsync(u => u.Username.ToLower() == newUsername))
                    return BadRequest(new { error = "That username is already taken." });

                if (request.Name.Length > 150 || request.Username.Length > 50)
                    return BadRequest(new { error = "Invalid parameter." });

                if (request.Pin.Length < 4 || request.Pin.Length > 12 || !request.Pin.All(char.IsDigit))
                    return BadRequest(new { error = "The PIN must be 4 to 12 digits." });

                if (string.Equals(request.Role, nameof(UserRole.Owner), StringComparison.OrdinalIgnoreCase) && !IsOwner())
                    return StatusCode(403, new { error = "Only an owner can make someone an owner." });

                var salt = TokenService.CreateSalt();
                var user = new User
                {
                    Name = request.Name,
                    Username = request.Username,
                    Email = request.Email,
                    PinSalt = salt,
                    PinHash = TokenService.HashPin(request.Pin, salt),
                    Role = Enum.TryParse<UserRole>(request.Role, true, out var role) ? role : UserRole.Sales,
                    IsActive = request.IsActive ?? true,
                };

                DB.Users.Add(user);
                await DB.SaveChangesAsync();

                return Ok(ToDto(user));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while adding the user.", exception = e.Message });
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists every crew account.
        /// </summary>
        /// <returns>All users, newest last.</returns>
        [HttpGet("users")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetUsers()
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = "Only an administrator may manage crew accounts." });

                var users = await DB.Users.OrderBy(u => u.Name).ToListAsync();

                // Sign-in times are for the owner's eyes only.
                var owner = IsOwner();
                return Ok(users.Select(u =>
                {
                    var dto = ToDto(u);
                    if (owner)
                        dto.LastLoginAt = u.LastLoginAt;
                    return dto;
                }).ToList());
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting users.", exception = e.Message });
            }
        }

        /// <summary>
        /// Lists the names of the active reps, used to fill the CFS Rep Name picker on an order.
        /// </summary>
        /// <returns>Active user names.</returns>
        [HttpGet("reps")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetReps()
        {
            try
            {
                var names = await DB.Users
                    .Where(u => u.IsActive)
                    .OrderBy(u => u.Name)
                    .Select(u => u.Name)
                    .ToListAsync();

                return Ok(names);
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting reps.", exception = e.Message });
            }
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Updates a crew account. The PIN is only changed when one is supplied.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated user.</returns>
        [HttpPatch("user")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateUser([FromBody] UserDto request)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = "Only an administrator may manage crew accounts." });

                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var user = await DB.Users.FindAsync(request.Id.Value);
                if (user == null)
                    return NotFound(new { error = "User not found." });

                // Only an owner can change an owner's account, and nobody can change their own role
                // - so there is always at least the owner making the change.
                if (user.Role == UserRole.Owner && !IsOwner())
                    return StatusCode(403, new { error = "Only an owner can change an owner's account." });

                if (!string.IsNullOrWhiteSpace(request.Role)
                    && Enum.TryParse<UserRole>(request.Role, true, out var requestedRole)
                    && requestedRole != user.Role)
                {
                    if (user.Id == GetCurrentUserId())
                        return BadRequest(new { error = "You cannot change your own role." });

                    if (requestedRole == UserRole.Owner && !IsOwner())
                        return StatusCode(403, new { error = "Only an owner can make someone an owner." });
                }

                if (!string.IsNullOrWhiteSpace(request.Username) && request.Username != user.Username)
                {
                    var takenBy = request.Username.Trim().ToLower();
                    if (await DB.Users.AnyAsync(u => u.Username.ToLower() == takenBy && u.Id != user.Id))
                        return BadRequest(new { error = "That username is already taken." });

                    if (request.Username.Length > 50)
                        return BadRequest(new { error = "Invalid parameter." });

                    user.Username = request.Username;
                }

                if (!string.IsNullOrWhiteSpace(request.Name))
                {
                    if (request.Name.Length > 150)
                        return BadRequest(new { error = "Invalid parameter." });

                    user.Name = request.Name;
                }

                if (request.Email != null)
                    user.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email;

                if (!string.IsNullOrWhiteSpace(request.Role) &&
                    Enum.TryParse<UserRole>(request.Role, true, out var role))
                    user.Role = role;

                if (request.IsActive != null)
                {
                    user.IsActive = request.IsActive.Value;

                    // Deactivating an account must also end any session it already holds.
                    if (!user.IsActive)
                    {
                        user.RefreshToken = null;
                        user.RefreshTokenExpiry = null;
                    }
                }

                if (!string.IsNullOrWhiteSpace(request.Pin))
                {
                    if (request.Pin.Length < 4 || request.Pin.Length > 12 || !request.Pin.All(char.IsDigit))
                        return BadRequest(new { error = "The PIN must be 4 to 12 digits." });

                    var salt = TokenService.CreateSalt();
                    user.PinSalt = salt;
                    user.PinHash = TokenService.HashPin(request.Pin, salt);
                }

                await DB.SaveChangesAsync();

                return Ok(ToDto(user));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while updating the user.", exception = e.Message });
            }
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Deactivates a crew account, keeping it on file. An owner can instead delete it for good
        /// with permanent=true: their sales stay, but every place that named them is cleared.
        /// </summary>
        /// <param name="id">User id</param>
        /// <param name="permanent">True to delete the account rather than deactivate it (owner only)</param>
        /// <returns>200 when the account was deactivated or deleted.</returns>
        [HttpDelete("user/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteUser(int id, [FromQuery] bool permanent = false)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = "Only an administrator may manage crew accounts." });

                if (permanent && !IsOwner())
                    return StatusCode(403, new { error = "Only an owner can delete an account permanently." });

                var user = await DB.Users.FindAsync(id);
                if (user == null)
                    return NotFound(new { error = "User not found." });

                if (GetCurrentUserId() == id)
                    return BadRequest(new { error = "You cannot deactivate or delete your own account." });

                if (user.Role == UserRole.Owner && !IsOwner())
                    return StatusCode(403, new { error = "Only an owner can change an owner's account." });

                if (permanent)
                {
                    await PermanentDelete.UserAsync(DB, user);
                    return Ok(new { deleted = true });
                }

                user.IsActive = false;
                user.RefreshToken = null;
                user.RefreshTokenExpiry = null;
                await DB.SaveChangesAsync();

                return Ok();
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while deactivating the user.", exception = e.Message });
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
