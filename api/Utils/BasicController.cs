using System.Diagnostics;
using System.Security.Claims;
using api.Data;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Utils
{
    /// <summary>
    /// Base class for every controller in the solution. Carries the shared dependencies, the
    /// tracing helper and the signed-in user's access scope, so actions never touch ILogger directly
    /// and every territory check goes through one place.
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
        /// Token issuing and password hashing
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
        /// The signed-in user's role and territory, built by AccessScopeMiddleware. Every action
        /// behind [Authorize] has one.
        /// </summary>
        protected AccessScope Scope =>
            HttpContext.Items[AccessScopeMiddleware.ItemKey] as AccessScope
            ?? throw new InvalidOperationException("No access scope for this request.");

        /// <summary>
        /// A 500 with a message for the user. The exception's own text is only included when
        /// running in Development - in production it could reveal how the server is put together.
        /// </summary>
        /// <param name="message">What failed, in plain words</param>
        /// <param name="exception">The exception, which is always traced</param>
        /// <returns>The response.</returns>
        protected ObjectResult ServerError(string message, Exception exception)
        {
            Trace(TraceEventType.Critical, exception.ToString());

            var environment = HttpContext.RequestServices.GetService<IWebHostEnvironment>();
            return environment?.IsDevelopment() == true
                ? StatusCode(500, new { error = message, exception = exception.Message })
                : StatusCode(500, new { error = message });
        }

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
            if (role == UserRole.Admin && User.IsInRole(nameof(UserRole.SystemAdmin)))
                return true;

            return User.IsInRole(role.ToString());
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
        protected bool IsSystemAdmin()
        {
            return User.IsInRole(nameof(UserRole.SystemAdmin));
        }

        /// <summary>
        /// Whether the signed-in user may work with an event: it's in their territory, or they're
        /// company-wide. A territory a system admin or administrator has narrowed to doesn't hide other
        /// territories' events from a direct link - it only filters lists.
        /// </summary>
        /// <param name="saleEvent">The event</param>
        /// <returns>True when allowed.</returns>
        protected bool CanSee(Event? saleEvent) => saleEvent != null && Scope.CanSee(saleEvent.TerritoryId);

        /// <summary>
        /// Whether the signed-in user may change a catalog item, delivery option or financing option:
        /// a manager or above, in one of their territories.
        /// </summary>
        /// <param name="itemTerritoryId">The item's territory</param>
        /// <returns>True when allowed.</returns>
        protected bool CanEditCatalog(int? itemTerritoryId) =>
            Scope.IsAtLeast(UserRole.Manager) && Scope.CanSee(itemTerritoryId);

        /// <summary>
        /// Which territory's catalog a new item goes in: the one asked for, or else the one in view.
        /// Each territory has its own catalog, so it has to be one territory, and one the user may
        /// change the catalog of.
        /// </summary>
        /// <param name="requested">The territory asked for, or null for the one in view</param>
        /// <returns>The territory, or the response to return instead.</returns>
        protected async Task<(int TerritoryId, IActionResult? Problem)> CatalogTerritoryAsync(int? requested)
        {
            if (!Scope.IsAtLeast(UserRole.Manager))
                return (0, Forbidden("Only a manager, administrator or system admin may change the catalog."));

            if ((requested ?? Scope.TerritoryId) is not { } territoryId)
                return (0, BadRequest(new { error = "Pick the territory whose catalog this goes in." }));

            if (!Scope.CanSee(territoryId))
                return (0, Forbidden("You can only change the catalog of your own territories."));

            if (!await DB.Territories.AnyAsync(t => t.Id == territoryId && t.IsActive))
                return (0, BadRequest(new { error = "That territory doesn't exist or is switched off." }));

            return (territoryId, null);
        }

        #endregion
    }
}
