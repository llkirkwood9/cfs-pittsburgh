using api.Data;
using api.Models;
using api.Utils;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Catalog
{
    /// <summary>
    /// Base class for the controllers that change a territory's catalog: products, delivery options
    /// and financing options. Holds the shared "may this user change this catalog" rules.
    /// </summary>
    public abstract class CatalogItemController(
        ApplicationDbContext db,
        ILogger<BasicController> logger) : BasicController(db, logger)
    {
        #region Internal Methods

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
