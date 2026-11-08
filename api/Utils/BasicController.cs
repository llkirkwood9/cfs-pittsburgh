using System.Diagnostics;
using System.Security.Claims;
using api.Data;
using api.Models;
using Microsoft.AspNetCore.Mvc;

namespace api.Utils
{
    /// <summary>
    /// Base class for every controller in the solution. Carries the shared dependencies, the
    /// tracing helper and the signed-in user's access scope, so actions never touch ILogger directly
    /// and every territory check goes through one place.
    /// </summary>
    public class BasicController(
        ApplicationDbContext db,
        ILogger<BasicController> logger) : ControllerBase
    {
        #region Internal Fields

        /// <summary>
        /// EF context
        /// </summary>
        protected readonly ApplicationDbContext DB = db;

        /// <summary>
        /// Logger, written through Trace rather than directly
        /// </summary>
        protected readonly ILogger<BasicController> Logger = logger;

        #endregion

        #region Internal Methods

        /// <summary>
        /// Writes a trace through the shared tracing facade.
        /// </summary>
        /// <param name="eventType">Severity</param>
        /// <param name="message">Message to trace</param>
        protected void Trace(TraceEventType eventType, string message)
        {
            TraceControl.Trace(TraceControlSource.Api, eventType, Logger, message);
        }

        /// <summary>
        /// The signed-in user's role and territory, built by AccessScopeMiddleware. Every action
        /// behind [Authorize] has one.
        /// </summary>
        protected AccessScope Scope =>
            HttpContext.Items[AccessScopeMiddleware.ItemKey] as AccessScope
            ?? throw new InvalidOperationException("No access scope for this request.");

        /// <summary>
        /// A 403 with a reason.
        /// </summary>
        /// <param name="message">Why it's not allowed</param>
        /// <returns>The response.</returns>
        protected ObjectResult Forbidden(string message) => StatusCode(403, new { error = message });

        /// <summary>
        /// Reads the signed-in user id out of the bearer token.
        /// </summary>
        /// <returns>The user id, or null when the request is unauthenticated.</returns>
        protected int? GetCurrentUserId()
        {
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(raw, out var id) ? id : null;
        }

        /// <summary>
        /// Reads the signed-in user's display name out of the bearer token.
        /// </summary>
        /// <returns>The display name, or null when the request is unauthenticated.</returns>
        protected string? GetCurrentUserName()
        {
            return User.FindFirstValue(ClaimTypes.Name);
        }

        /// <summary>
        /// Checks whether the signed-in user holds the supplied role. Administrator also holds for
        /// a system admin. For "this role or anything more senior", use IsAtLeast.
        /// </summary>
        /// <param name="role">Role to test</param>
        /// <returns>True when the user is in that role.</returns>
        protected bool IsInRole(UserRole role)
        {
            // A system admin can do everything an administrator can.
            if (role == UserRole.Admin && Scope.Role == UserRole.SystemAdmin)
                return true;

            return Scope.Role == role;
        }

        /// <summary>
        /// Whether the signed-in user's role is at least as senior as the one given.
        /// </summary>
        /// <param name="minimum">The least senior role allowed</param>
        /// <returns>True when allowed.</returns>
        protected bool IsAtLeast(UserRole minimum) => Scope.IsAtLeast(minimum);

        /// <summary>
        /// Whether the signed-in user is a system admin - the only role allowed to delete permanently.
        /// </summary>
        /// <returns>True for a system admin.</returns>
        protected bool IsSystemAdmin() => Scope.Role == UserRole.SystemAdmin;

        #endregion
    }
}
