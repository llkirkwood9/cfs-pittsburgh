using api.Models;

namespace api.Utils
{
    /// <summary>
    /// The one way records are limited to the territories a user may see. Lists use VisibleTo,
    /// which follows the territory picked in the menu bar; a record opened directly uses
    /// IfVisibleTo, which allows any of the user's territories - the picker only filters lists.
    /// </summary>
    public static class TerritoryScoping
    {
        #region Lists

        /// <summary>The events in the territories the request covers.</summary>
        /// <param name="query">Events</param>
        /// <param name="scope">The request's access scope</param>
        /// <returns>The filtered query.</returns>
        public static IQueryable<Event> VisibleTo(this IQueryable<Event> query, AccessScope scope) =>
            query.InTerritories(scope.VisibleTerritoryIds);

        /// <summary>The events in the territories given, or every event when null.</summary>
        /// <param name="query">Events</param>
        /// <param name="territoryIds">The territories, or null for all</param>
        /// <returns>The filtered query.</returns>
        public static IQueryable<Event> InTerritories(this IQueryable<Event> query, IReadOnlyCollection<int>? territoryIds) =>
            territoryIds == null ? query : query.Where(e => territoryIds.Contains(e.TerritoryId));

        /// <summary>The orders whose event is in the territories the request covers.</summary>
        /// <param name="query">Orders</param>
        /// <param name="scope">The request's access scope</param>
        /// <returns>The filtered query.</returns>
        public static IQueryable<Order> VisibleTo(this IQueryable<Order> query, AccessScope scope) =>
            query.InTerritories(scope.VisibleTerritoryIds);

        /// <summary>The orders whose event is in the territories given, or every order when null.</summary>
        /// <param name="query">Orders</param>
        /// <param name="territoryIds">The territories, or null for all</param>
        /// <returns>The filtered query.</returns>
        public static IQueryable<Order> InTerritories(this IQueryable<Order> query, IReadOnlyCollection<int>? territoryIds) =>
            territoryIds == null ? query : query.Where(o => territoryIds.Contains(o.Event!.TerritoryId));

        /// <summary>The products in the catalogs of the territories the request covers.</summary>
        /// <param name="query">Products</param>
        /// <param name="scope">The request's access scope</param>
        /// <returns>The filtered query.</returns>
        public static IQueryable<Product> VisibleTo(this IQueryable<Product> query, AccessScope scope) =>
            query.InTerritories(scope.VisibleTerritoryIds);

        /// <summary>The products in the catalogs of the territories given, or every territory's when null.</summary>
        /// <param name="query">Products</param>
        /// <param name="territoryIds">The territories, or null for all</param>
        /// <returns>The filtered query.</returns>
        public static IQueryable<Product> InTerritories(this IQueryable<Product> query, IReadOnlyCollection<int>? territoryIds) =>
            territoryIds == null
                ? query.Where(p => p.TerritoryId != null)
                : query.Where(p => p.TerritoryId != null && territoryIds.Contains(p.TerritoryId.Value));

        /// <summary>The delivery options of the territories the request covers.</summary>
        /// <param name="query">Delivery options</param>
        /// <param name="scope">The request's access scope</param>
        /// <returns>The filtered query.</returns>
        public static IQueryable<DeliveryOption> VisibleTo(this IQueryable<DeliveryOption> query, AccessScope scope)
        {
            var territoryIds = scope.VisibleTerritoryIds;
            return territoryIds == null
                ? query.Where(d => d.TerritoryId != null)
                : query.Where(d => d.TerritoryId != null && territoryIds.Contains(d.TerritoryId.Value));
        }

        /// <summary>The financing options of the territories given, or every territory's when null.</summary>
        /// <param name="query">Financing options</param>
        /// <param name="territoryIds">The territories, or null for all</param>
        /// <returns>The filtered query.</returns>
        public static IQueryable<FinanceOption> InTerritories(this IQueryable<FinanceOption> query, IReadOnlyCollection<int>? territoryIds) =>
            territoryIds == null
                ? query.Where(f => f.TerritoryId != null)
                : query.Where(f => f.TerritoryId != null && territoryIds.Contains(f.TerritoryId.Value));

        /// <summary>The categories of the territories given, or every territory's when null.</summary>
        /// <param name="query">Categories</param>
        /// <param name="territoryIds">The territories, or null for all</param>
        /// <returns>The filtered query.</returns>
        public static IQueryable<Category> InTerritories(this IQueryable<Category> query, IReadOnlyCollection<int>? territoryIds) =>
            territoryIds == null
                ? query.Where(c => c.TerritoryId != null)
                : query.Where(c => c.TerritoryId != null && territoryIds.Contains(c.TerritoryId.Value));

        /// <summary>The users belonging to any of the territories the request covers.</summary>
        /// <param name="query">Users</param>
        /// <param name="scope">The request's access scope</param>
        /// <returns>The filtered query.</returns>
        public static IQueryable<User> VisibleTo(this IQueryable<User> query, AccessScope scope)
        {
            var territoryIds = scope.VisibleTerritoryIds;
            return territoryIds == null ? query : query.Where(u => u.Territories.Any(t => territoryIds.Contains(t.TerritoryId)));
        }

        #endregion

        #region Single Records

        /// <summary>
        /// The record when it belongs to one of the user's territories, otherwise null - so a
        /// record in someone else's territory answers the same as one that doesn't exist.
        /// </summary>
        /// <param name="item">The loaded record, or null when not found</param>
        /// <param name="scope">The request's access scope</param>
        /// <typeparam name="T">The record type</typeparam>
        /// <returns>The record, or null.</returns>
        public static T? IfVisibleTo<T>(this T? item, AccessScope scope) where T : class, ITerritoryOwned =>
            item != null && scope.CanSee(item.TerritoryId) ? item : null;

        #endregion
    }
}
