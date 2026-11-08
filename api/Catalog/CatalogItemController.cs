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
        #region Internal Fields

        /// <summary>Why someone below manager can't change the catalog.</summary>
        protected const string ManagersOnlyMessage = "Only a manager, administrator or system admin may change the catalog.";

        /// <summary>Why a manager can't change another territory's catalog.</summary>
        protected const string NotYourCatalogMessage = "You can only change the catalog of your own territories.";

        #endregion

        #region Internal Methods

        /// <summary>
        /// The 403 for someone below manager, who can't change the catalog at all.
        /// </summary>
        /// <returns>The response, or null when they may.</returns>
        protected IActionResult? DenyUnlessManager() =>
            Scope.IsAtLeast(UserRole.Manager) ? null : Forbidden(ManagersOnlyMessage);

        /// <summary>
        /// The 403 for someone who can't change this item's catalog (see CanEditCatalog).
        /// </summary>
        /// <param name="itemTerritoryId">The item's territory</param>
        /// <returns>The response, or null when they may.</returns>
        protected IActionResult? DenyUnlessEditable(int? itemTerritoryId) =>
            CanEditCatalog(itemTerritoryId) ? null : Forbidden(NotYourCatalogMessage);

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
                return (0, Forbidden(ManagersOnlyMessage));

            if ((requested ?? Scope.TerritoryId) is not { } territoryId)
                return (0, BadRequest(new { error = "Pick the territory whose catalog this goes in." }));

            if (!Scope.CanSee(territoryId))
                return (0, Forbidden(NotYourCatalogMessage));

            if (!await DB.Territories.AnyAsync(t => t.Id == territoryId && t.IsActive))
                return (0, BadRequest(new { error = "That territory doesn't exist or is switched off." }));

            return (territoryId, null);
        }

        /// <summary>
        /// Puts one territory's list (delivery options or financing options) in a new order. The
        /// ids must be the whole list, each once; the list is the first id's territory's.
        /// </summary>
        /// <param name="ids">Every id in the list, in the new order</param>
        /// <param name="find">Loads one item, tracked</param>
        /// <param name="listOf">Loads a territory's whole list, tracked</param>
        /// <typeparam name="T">The kind of item</typeparam>
        /// <returns>The response to return instead, or null once the new order is saved.</returns>
        protected async Task<IActionResult?> ReorderAsync<T>(List<int> ids, Func<int, ValueTask<T?>> find, Func<int?, Task<List<T>>> listOf)
            where T : class, ISortedCatalogItem
        {
            if (DenyUnlessManager() is { } notManager)
                return notManager;

            if (ids.Count == 0 || ids.Distinct().Count() != ids.Count)
                return BadRequest(new { error = "Invalid parameter." });

            var first = await find(ids[0]);
            if (first == null)
                return BadRequest(new { error = "The list has changed. Refresh and try again." });

            var group = await listOf(first.TerritoryId);
            if (group.Count != ids.Count || group.Any(o => !ids.Contains(o.Id)))
                return BadRequest(new { error = "The list has changed. Refresh and try again." });

            if (DenyUnlessEditable(first.TerritoryId) is { } notEditable)
                return notEditable;

            foreach (var item in group)
                item.SortOrder = ids.IndexOf(item.Id) + 1;

            await DB.SaveChangesAsync();
            return null;
        }

        #endregion
    }
}
