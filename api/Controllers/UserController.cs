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
    /// Crew accounts. System Admins and administrators manage everyone (only a system admin touches a system admin);
    /// a territory manager manages the sales and checkout crew in their own territory. Every role
    /// below administrator belongs to exactly one territory.
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
        #region Private Fields

        private const string ManagersOnly = "Only a manager, administrator or system admin may manage crew accounts.";

        #endregion

        #region POST Methods

        /// <summary>
        /// Adds a crew account with a starting password, which they change at their first sign-in.
        /// </summary>
        /// <param name="request">Name, username, password, role and territory</param>
        /// <returns>The created user.</returns>
        [HttpPost("user")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddUser([FromBody] UserDto request)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden(ManagersOnly);

                if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Username))
                    return BadRequest(new { error = "Enter a name and a username." });

                if (request.Name.Trim().Length > 150 || request.Username.Trim().Length > 50)
                    return BadRequest(new { error = "The name or username is too long." });

                var username = request.Username.Trim();
                if (!username.All(c => char.IsLetterOrDigit(c) || c is '.' or '-' or '_' or '@'))
                    return BadRequest(new { error = "Usernames can use letters, numbers and . - _ @ only." });

                var lower = username.ToLower();
                if (await DB.Users.AnyAsync(u => u.Username.ToLower() == lower))
                    return BadRequest(new { error = "That username is already taken." });

                var role = Enum.TryParse<UserRole>(request.Role, true, out var parsed) ? parsed : UserRole.Sales;
                var (territoryId, problem) = await CheckRoleAndTerritoryAsync(role, request.TerritoryId ?? Scope.TerritoryId);
                if (problem != null)
                    return problem;

                var user = new User
                {
                    Name = request.Name.Trim(),
                    Username = username,
                    Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
                    Role = role,
                    TerritoryId = territoryId,
                    IsActive = request.IsActive ?? true,
                };

                var weak = PasswordPolicy.Check(request.Password, user.Username, user.Name);
                if (weak != null)
                    return BadRequest(new { error = weak });

                // They choose their own at the first sign-in, so whoever set this never knows it for long.
                Passwords.Set(TokenService, user, request.Password!, mustChange: true);

                DB.Users.Add(user);
                await DB.SaveChangesAsync();
                await DB.Entry(user).Reference(u => u.Territory).LoadAsync();

                Trace(TraceEventType.Information, $"{GetCurrentUserName()} added {user.Username} ({user.Role}).");
                return Ok(UserMapper.ToDto(user, IsSystemAdmin()));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while adding the user.", e);
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists the crew accounts the signed-in user manages or works alongside: everyone for an
        /// system admin or administrator (or one territory's when they've picked one), a manager's own
        /// territory for a manager.
        /// </summary>
        /// <returns>Users by name.</returns>
        [HttpGet("users")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetUsers()
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden(ManagersOnly);

                var scope = Scope;
                var query = DB.Users.Include(u => u.Territory).AsNoTracking().AsQueryable();
                if (scope.TerritoryId != null)
                    query = query.Where(u => u.TerritoryId == scope.TerritoryId);

                var users = await query.OrderBy(u => u.Name).ToListAsync();

                // Sign-in times are for the system admin's eyes only.
                var systemAdmin = IsSystemAdmin();
                return Ok(users.Select(u => UserMapper.ToDto(u, systemAdmin)).ToList());
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting users.", e);
            }
        }

        /// <summary>
        /// Lists the names of the active reps, used to fill the CFS Rep Name picker on an order:
        /// the crew of the territory being worked, plus the company-wide system admins and administrators.
        /// </summary>
        /// <param name="eventId">The event the order is for, to use its territory</param>
        /// <returns>Active user names.</returns>
        [HttpGet("reps")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetReps([FromQuery] int? eventId = null)
        {
            try
            {
                var territoryId = Scope.TerritoryId;
                if (eventId != null)
                {
                    var saleEvent = await DB.Events.AsNoTracking().FirstOrDefaultAsync(e => e.Id == eventId.Value);
                    if (!CanSee(saleEvent))
                        return NotFound(new { error = "Event not found." });
                    territoryId = saleEvent!.TerritoryId;
                }

                var names = await DB.Users
                    .Where(u => u.IsActive && (territoryId == null || u.TerritoryId == territoryId || u.TerritoryId == null))
                    .OrderBy(u => u.Name)
                    .Select(u => u.Name)
                    .ToListAsync();

                return Ok(names);
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting reps.", e);
            }
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Updates a crew account. A password supplied here resets it: the user must choose their
        /// own at the next sign-in, and every device they're signed in on is signed out.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated user.</returns>
        [HttpPatch("user")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateUser([FromBody] UserDto request)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden(ManagersOnly);

                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var user = await DB.Users.Include(u => u.Territory).FirstOrDefaultAsync(u => u.Id == request.Id.Value);
                if (user == null)
                    return NotFound(new { error = "User not found." });
                if (!CanManage(user))
                    return Forbidden(CannotManage(user));

                var self = user.Id == GetCurrentUserId();
                var role = !string.IsNullOrWhiteSpace(request.Role) && Enum.TryParse<UserRole>(request.Role, true, out var r) ? r : user.Role;
                var territoryChange = request.TerritoryId != null && request.TerritoryId != user.TerritoryId;

                if (role != user.Role || territoryChange)
                {
                    if (self)
                        return BadRequest(new { error = "You cannot change your own role or territory." });

                    var (territoryId, problem) = await CheckRoleAndTerritoryAsync(role, request.TerritoryId ?? user.TerritoryId);
                    if (problem != null)
                        return problem;

                    user.Role = role;
                    user.TerritoryId = territoryId;
                }

                if (!string.IsNullOrWhiteSpace(request.Username) && request.Username.Trim() != user.Username)
                {
                    var username = request.Username.Trim();
                    if (username.Length > 50 || !username.All(c => char.IsLetterOrDigit(c) || c is '.' or '-' or '_' or '@'))
                        return BadRequest(new { error = "Usernames can use letters, numbers and . - _ @ only, up to 50 characters." });

                    var lower = username.ToLower();
                    if (await DB.Users.AnyAsync(u => u.Username.ToLower() == lower && u.Id != user.Id))
                        return BadRequest(new { error = "That username is already taken." });

                    user.Username = username;
                }

                if (!string.IsNullOrWhiteSpace(request.Name))
                {
                    if (request.Name.Trim().Length > 150)
                        return BadRequest(new { error = "The name is too long." });

                    user.Name = request.Name.Trim();
                }

                if (request.Email != null)
                    user.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();

                var endSessions = false;
                if (request.IsActive != null && request.IsActive.Value != user.IsActive)
                {
                    if (self)
                        return BadRequest(new { error = "You cannot deactivate your own account." });

                    user.IsActive = request.IsActive.Value;
                    endSessions |= !user.IsActive;
                }

                if (request.IsLockedOut == false)
                {
                    user.LockoutUntil = null;
                    user.FailedLoginCount = 0;
                }

                if (!string.IsNullOrEmpty(request.Password))
                {
                    var weak = PasswordPolicy.Check(request.Password, user.Username, user.Name);
                    if (weak != null)
                        return BadRequest(new { error = weak });

                    Passwords.Set(TokenService, user, request.Password, mustChange: !self);
                    endSessions = true;
                }

                // A role or territory change takes effect at the user's next request anyway; ending
                // their sessions makes sure a deactivated or reset account can't renew.
                if (endSessions)
                    await DB.UserSessions.Where(s => s.UserId == user.Id).ExecuteDeleteAsync();

                await DB.SaveChangesAsync();
                await DB.Entry(user).Reference(u => u.Territory).LoadAsync();

                Trace(TraceEventType.Information, $"{GetCurrentUserName()} updated {user.Username}.");
                return Ok(UserMapper.ToDto(user, IsSystemAdmin()));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while updating the user.", e);
            }
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Deactivates a crew account, keeping it on file. A system admin can instead delete it for good
        /// with permanent=true: their sales stay, but every place that named them is cleared.
        /// </summary>
        /// <param name="id">User id</param>
        /// <param name="permanent">True to delete the account rather than deactivate it (system admin only)</param>
        /// <returns>200 when the account was deactivated or deleted.</returns>
        [HttpDelete("user/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteUser(int id, [FromQuery] bool permanent = false)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden(ManagersOnly);

                if (permanent && !IsSystemAdmin())
                    return Forbidden("Only a system admin can delete an account permanently.");

                var user = await DB.Users.FindAsync(id);
                if (user == null)
                    return NotFound(new { error = "User not found." });

                if (GetCurrentUserId() == id)
                    return BadRequest(new { error = "You cannot deactivate or delete your own account." });

                if (!CanManage(user))
                    return Forbidden(CannotManage(user));

                if (permanent)
                {
                    await PermanentDelete.UserAsync(DB, user);
                    return Ok(new { deleted = true });
                }

                user.IsActive = false;
                await DB.UserSessions.Where(s => s.UserId == user.Id).ExecuteDeleteAsync();
                await DB.SaveChangesAsync();

                return Ok();
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while deactivating the user.", e);
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Whether the signed-in user may change this account: a system admin anyone; an administrator
        /// anyone but a system admin; a manager only crew below manager in their own territory.
        /// </summary>
        private bool CanManage(User user)
        {
            var scope = Scope;
            if (scope.Role == UserRole.SystemAdmin)
                return true;
            if (scope.Role == UserRole.Admin)
                return user.Role != UserRole.SystemAdmin;
            return scope.Role == UserRole.Manager
                   && user.TerritoryId == scope.HomeTerritoryId
                   && AccessScope.Rank(user.Role) < AccessScope.Rank(UserRole.Manager);
        }

        private static string CannotManage(User user) =>
            user.Role == UserRole.SystemAdmin
                ? "Only a system admin can change a system admin's account."
                : "A manager can only change the sales and checkout crew in their own territory.";

        /// <summary>
        /// Checks the signed-in user may give this role, and works out the territory that goes with
        /// it: none for system admins and administrators, an active territory for everyone else - for a
        /// manager's crew, always the manager's own.
        /// </summary>
        /// <returns>The territory to store, or the response to return instead.</returns>
        private async Task<(int? TerritoryId, IActionResult? Problem)> CheckRoleAndTerritoryAsync(UserRole role, int? territoryId)
        {
            var scope = Scope;

            if (role == UserRole.SystemAdmin && scope.Role != UserRole.SystemAdmin)
                return (null, Forbidden("Only a system admin can make someone a system admin."));

            if (scope.Role == UserRole.Manager)
            {
                if (AccessScope.Rank(role) >= AccessScope.Rank(UserRole.Manager))
                    return (null, Forbidden("A manager can only give the Sales, Checkout or Sales & Checkout roles."));

                if (territoryId != null && territoryId != scope.HomeTerritoryId)
                    return (null, Forbidden("A manager can only look after people in their own territory."));

                return (scope.HomeTerritoryId, null);
            }

            if (!AccessScope.NeedsTerritory(role))
                return (null, null);

            if (territoryId == null)
                return (null, BadRequest(new { error = "Pick the territory this person works in." }));

            if (!await DB.Territories.AnyAsync(t => t.Id == territoryId && t.IsActive))
                return (null, BadRequest(new { error = "That territory doesn't exist or is switched off." }));

            return (territoryId, null);
        }

        #endregion
    }
}
