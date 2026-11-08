using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Catalog
{
    /// <summary>
    /// The two shapes a product is loaded in: with everything, to show or export it, and with
    /// what an edit changes, to save it.
    /// </summary>
    public static class ProductQueries
    {
        /// <summary>
        /// A product with everything shown about it: its territory, sizes with what each bundle
        /// includes (and those items' products and territories), its delivery choices and its
        /// selections.
        /// </summary>
        /// <param name="query">Products</param>
        /// <returns>The query with everything included.</returns>
        public static IQueryable<Product> WithEverything(this IQueryable<Product> query) =>
            query
                .Include(p => p.Territory)
                .Include(p => p.Variants)
                .ThenInclude(v => v.Components)
                .ThenInclude(c => c.ComponentVariant)
                .ThenInclude(cv => cv!.Product)
                .ThenInclude(cp => cp!.Territory)
                .Include(p => p.DeliveryOptions)
                .ThenInclude(d => d.DeliveryOption)
                .Include(p => p.Options)
                .ThenInclude(o => o.Choices)
                .AsSplitQuery();

        /// <summary>
        /// A product with what saving it changes: its sizes and what they include, its delivery
        /// choices and its selections.
        /// </summary>
        /// <param name="query">Products</param>
        /// <returns>The query with the editable parts included.</returns>
        public static IQueryable<Product> ForEditing(this IQueryable<Product> query) =>
            query
                .Include(p => p.Variants)
                .ThenInclude(v => v.Components)
                .Include(p => p.DeliveryOptions)
                .Include(p => p.Options)
                .ThenInclude(o => o.Choices)
                .AsSplitQuery();
    }
}
