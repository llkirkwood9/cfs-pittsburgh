using System.Security.Claims;
using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Utils
{
    /// <summary>
    /// Who is asking and which territory they're working in, read fresh from the database for every
    /// request. System Admins and administrators work across every territory; everyone else across
    /// the territories they belong to - one or several. Anyone with more than one may narrow to one
    /// with the X-Territory-Id header (the territory picker).
    /// </summary>
    public sealed class AccessScope
    {
        #region Public Properties

        /// <summary>The signed-in user's id.</summary>
        public int UserId { get; init; }

        /// <summary>Their name, as printed on orders.</summary>
        public string Name { get; init; } = string.Empty;

        /// <summary>Their role.</summary>
        public UserRole Role { get; init; }

        /// <summary>
        /// The switched-on territories a manager or crew member belongs to. Empty for system admins
        /// and administrators, who belong to every territory.
        /// </summary>
        public IReadOnlyList<int> MemberTerritoryIds { get; init; } = [];

        /// <summary>The territory picked in the menu bar, or null for all of the user's territories.</summary>
        public int? SelectedTerritoryId { get; init; }

        /// <summary>System Admins and administrators: not tied to any territory.</summary>
        public bool IsCompanyWide => Role is UserRole.SystemAdmin or UserRole.Admin;

        /// <summary>Whether the user works in more than one territory, and so has the picker.</summary>
        public bool CanSwitch => IsCompanyWide || MemberTerritoryIds.Count > 1;

        /// <summary>
        /// The one territory this request is about: the one picked, or a crew member's only one.
        /// Null means all the user's territories - every territory, for a system admin or
        /// administrator.
        /// </summary>
        public int? TerritoryId => SelectedTerritoryId ?? (!IsCompanyWide && MemberTerritoryIds.Count == 1 ? MemberTerritoryIds[0] : null);

        /// <summary>
        /// The territories this request covers, for filtering lists: the one in view, or all the
        /// user's. Null means every territory (a system admin or administrator viewing them all).
        /// </summary>
        public List<int>? VisibleTerritoryIds =>
            TerritoryId is { } one ? [one] : IsCompanyWide ? null : MemberTerritoryIds.ToList();

        #endregion

        #region Public Methods

        /// <summary>
        /// Whether the user may see records belonging to a territory - one of theirs, whichever one
        /// is picked in the menu bar.
        /// </summary>
        /// <param name="territoryId">The record's territory</param>
        /// <returns>True when it's one of theirs, or they're company-wide.</returns>
        public bool CanSee(int? territoryId)
        {
            return territoryId != null && (IsCompanyWide || MemberTerritoryIds.Contains(territoryId.Value));
        }

        /// <summary>
        /// Whether the user holds a role at least as senior as the one given. Sales and checkout
        /// rank equally; Sales & Checkout covers both; a manager covers everything in their
        /// territory; an administrator everything but the system admin's permanent deletes.
        /// </summary>
        /// <param name="minimum">The least senior role allowed</param>
        /// <returns>True when allowed.</returns>
        public bool IsAtLeast(UserRole minimum)
        {
            return Rank(Role) >= Rank(minimum);
        }

        /// <summary>
        /// A role's seniority, for comparisons.
        /// </summary>
        /// <param name="role">The role</param>
        /// <returns>1 (floor) to 5 (system admin).</returns>
        public static int Rank(UserRole role) => role switch
        {
            UserRole.Sales or UserRole.Checkout => 1,
            UserRole.SalesCheckout => 2,
            UserRole.Manager => 3,
            UserRole.Admin => 4,
            UserRole.SystemAdmin => 5,
            _ => 0,
        };

        /// <summary>
        /// Whether a role is tied to a territory (everything below administrator).
        /// </summary>
        /// <param name="role">The role</param>
        /// <returns>True for managers and crew.</returns>
        public static bool NeedsTerritory(UserRole role) => role is not (UserRole.SystemAdmin or UserRole.Admin);

        #endregion
    }

    /// <summary>
    /// Builds the AccessScope for every signed-in request, and turns away an account that has been
    /// deactivated, moved, or whose territory has been switched off since its token was issued -
    /// so those take effect at once rather than when the token runs out. An account that has to
    /// choose a new password can reach nothing but the sign-in endpoints until it does.
    /// </summary>
    public sealed class AccessScopeMiddleware(RequestDelegate next)
    {
        /// <summary>The HttpContext.Items key the scope is kept under.</summary>
        public const string ItemKey = "cfs.scope";

        /// <summary>The header the territory picker sends.</summary>
        public const string TerritoryHeader = "X-Territory-Id";

        /// <summary>
        /// Loads the scope, or answers 401/403 itself.
        /// </summary>
        /// <param name="context">The request</param>
        /// <param name="db">EF context</param>
        public async Task InvokeAsync(HttpContext context, ApplicationDbContext db)
        {
            var principal = context.User;
            var requestPath = context.Request.Path.Value ?? string.Empty;
            var signingIn = requestPath.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase)
                            || requestPath.Equals("/api/auth/refresh", StringComparison.OrdinalIgnoreCase);

            if (signingIn
                || principal.Identity?.IsAuthenticated != true
                || !int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            {
                await next(context);
                return;
            }

            var user = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new
                {
                    u.Id, u.Name, u.Role, u.IsActive, u.MustChangePassword,
                    Territories = u.Territories
                        .Where(t => t.Territory!.IsActive)
                        .OrderBy(t => t.TerritoryId)
                        .Select(t => t.TerritoryId)
                        .ToList(),
                })
                .FirstOrDefaultAsync();

            // Gone, switched off, or every one of its territories switched off: the token no longer
            // counts.
            if (user == null || !user.IsActive || (AccessScope.NeedsTerritory(user.Role) && user.Territories.Count == 0))
            {
                await Deny(context, 401, "Your account is no longer active. Please sign in again.");
                return;
            }

            // A changed role means a new token with the right claims; a 401 makes the dashboard renew
            // it and retry. (Territories aren't in the token: they're read here on every request.)
            var tokenRole = principal.FindFirstValue(ClaimTypes.Role);
            if (tokenRole != user.Role.ToString())
            {
                await Deny(context, 401, "Your account was changed. Please sign in again.");
                return;
            }

            var path = context.Request.Path.Value ?? string.Empty;
            if (user.MustChangePassword && !path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "Choose a new password before carrying on.",
                    mustChangePassword = true,
                });
                return;
            }

            // The territory picked in the menu bar: any one for a system admin or administrator, one of
            // their own for everyone else. Anything else is ignored, which shows all of theirs.
            var companyWide = !AccessScope.NeedsTerritory(user.Role);
            int? selected = null;
            if (int.TryParse(context.Request.Headers[TerritoryHeader].FirstOrDefault(), out var picked)
                && (companyWide
                    ? await db.Territories.AnyAsync(t => t.Id == picked)
                    : user.Territories.Contains(picked)))
            {
                selected = picked;
            }

            context.Items[ItemKey] = new AccessScope
            {
                UserId = user.Id,
                Name = user.Name,
                Role = user.Role,
                MemberTerritoryIds = companyWide ? [] : user.Territories,
                SelectedTerritoryId = selected,
            };

            await next(context);
        }

        private static async Task Deny(HttpContext context, int status, string message)
        {
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new { error = message });
        }
    }
}
