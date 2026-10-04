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
        /// an owner. For "this role or anything more senior", use IsAtLeast.
        /// </summary>
        /// <param name="role">Role to test</param>
        /// <returns>True when the user is in that role.</returns>
        protected bool IsInRole(UserRole role)
        {
            // An owner can do everything an administrator can.
            if (role == UserRole.Admin && User.IsInRole(nameof(UserRole.Owner)))
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
        /// Whether the signed-in user is an owner - the only role allowed to delete permanently.
        /// </summary>
        /// <returns>True for an owner.</returns>
        protected bool IsOwner()
        {
            return User.IsInRole(nameof(UserRole.Owner));
        }

        /// <summary>
        /// Whether the signed-in user may work with an event: it's in their territory, or they're
        /// company-wide. A territory an owner or administrator has narrowed to doesn't hide other
        /// territories' events from a direct link - it only filters lists.
        /// </summary>
        /// <param name="saleEvent">The event</param>
        /// <returns>True when allowed.</returns>
        protected bool CanSee(Event? saleEvent) => saleEvent != null && Scope.CanSee(saleEvent.TerritoryId);

        /// <summary>
        /// Whether the signed-in user may change a catalog item or delivery option: owners and
        /// administrators any; a manager only their own territory's, never a global one.
        /// </summary>
        /// <param name="itemTerritoryId">The item's territory, null for a global item</param>
        /// <returns>True when allowed.</returns>
        protected bool CanEditCatalog(int? itemTerritoryId)
        {
            var scope = Scope;
            return scope.IsCompanyWide
                   || (scope.Role == UserRole.Manager && itemTerritoryId != null && itemTerritoryId == scope.HomeTerritoryId);
        }

        /// <summary>
        /// Whether a territory sells a catalog item: it's global, or the territory's own. With no
        /// territory (an owner or administrator viewing every territory) everything counts.
        /// </summary>
        /// <param name="itemTerritoryId">The item's territory, null for a global item</param>
        /// <param name="territoryId">The territory, or null for every territory</param>
        /// <returns>True when it's in that territory's catalog.</returns>
        protected static bool InCatalog(int? itemTerritoryId, int? territoryId) =>
            territoryId == null || itemTerritoryId == null || itemTerritoryId == territoryId;

        /// <summary>
        /// Which territory a new catalog item or delivery option belongs to: a manager's always goes
        /// in their own; an owner or administrator chooses one, or none for a global item.
        /// </summary>
        /// <param name="requested">The territory asked for, or null for global</param>
        /// <returns>The territory (null for global), or the response to return instead.</returns>
        protected async Task<(int? TerritoryId, IActionResult? Problem)> CatalogTerritoryAsync(int? requested)
        {
            var scope = Scope;
            if (!scope.IsCompanyWide)
                return scope.Role == UserRole.Manager
                    ? (scope.HomeTerritoryId, null)
                    : (null, Forbidden("Only a manager, administrator or owner may change the catalog."));

            if (requested == null)
                return (null, null);

            if (!await DB.Territories.AnyAsync(t => t.Id == requested && t.IsActive))
                return (null, BadRequest(new { error = "That territory doesn't exist or is switched off." }));

            return (requested, null);
        }

        #endregion
    }
}
