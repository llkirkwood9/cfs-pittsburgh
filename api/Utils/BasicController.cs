using System.Diagnostics;
using System.Security.Claims;
using api.Data;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Mvc;

namespace api.Utils
{
    /// <summary>
    /// Base class for every controller in the solution. Carries the shared dependencies and the
    /// tracing helper so actions never touch ILogger directly.
    /// </summary>
    public class BasicController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService) : ControllerBase
    {
        #region Internal Fields

        /// <summary>
        /// EF context
        /// </summary>
        protected readonly ApplicationDbContext DB = db;

        /// <summary>
        /// Factory for outbound HTTP calls
        /// </summary>
        protected readonly IHttpClientFactory HttpClientFactory = httpClientFactory;

        /// <summary>
        /// Application configuration
        /// </summary>
        protected readonly IConfiguration Config = config;

        /// <summary>
        /// Logger, written through Trace rather than directly
        /// </summary>
        protected readonly ILogger<BasicController> Logger = logger;

        /// <summary>
        /// Token issuing and PIN hashing
        /// </summary>
        protected readonly TokenService TokenService = tokenService;

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
        /// Checks whether the signed-in user holds the supplied role.
        /// </summary>
        /// <param name="role">Role to test</param>
        /// <returns>True when the user is in that role.</returns>
        protected bool IsInRole(UserRole role)
        {
            // A system admin can do everything an administrator can.
            if (role == UserRole.Admin && IsSystemAdmin())
                return true;

            return User.IsInRole(role.ToString());
        }

        /// <summary>
        /// Whether the signed-in user is a system admin - the only role allowed to delete permanently.
        /// </summary>
        /// <returns>True for a system admin.</returns>
        protected bool IsSystemAdmin()
        {
            // "Owner" is the role's old name, still carried by a sign-in issued before the rename
            // until it expires.
            return User.IsInRole(nameof(UserRole.SystemAdmin)) || User.IsInRole("Owner");
        }

        #endregion
    }
}
