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
        /// A product with everything shown about it: its territory and category, sizes with what
        /// each bundle includes (and those items' products, territories and categories), its
        /// delivery choices and its selections.
        /// </summary>
        /// <param name="query">Products</param>
        /// <returns>The query with everything included.</returns>
        public static IQueryable<Product> WithEverything(this IQueryable<Product> query) =>
            query
                .Include(p => p.Territory)
                .Include(p => p.Category)
                .Include(p => p.Variants)
                .ThenInclude(v => v.Components)
                .ThenInclude(c => c.ComponentVariant)
                .ThenInclude(cv => cv!.Product)
                .ThenInclude(cp => cp!.Territory)
                .Include(p => p.Variants)
                .ThenInclude(v => v.Components)
                .ThenInclude(c => c.ComponentVariant)
                .ThenInclude(cv => cv!.Product)
                .ThenInclude(cp => cp!.Category)
                .Include(p => p.DeliveryOptions)
                .ThenInclude(d => d.DeliveryOption)
                .Include(p => p.Options)
                .ThenInclude(o => o.Choices)
                .AsSplitQuery();

        /// <summary>
        /// Products with this brand and name as the editor stored them, ignoring case only (the
        /// database compares; spaces count). Used to stop a copy into a territory duplicating an
        /// item it already lists - a narrower test than CatalogRules.SameName, which the catalog
        /// file and copying between territories use to match items up.
        /// </summary>
        /// <param name="query">Products</param>
        /// <param name="brand">The brand</param>
        /// <param name="name">The name</param>
        /// <returns>The matching products.</returns>
        public static IQueryable<Product> WithBrandAndName(this IQueryable<Product> query, string brand, string name)
        {
            var lowerBrand = brand.ToLower();
            var lowerName = name.ToLower();
            return query.Where(p => p.Brand.ToLower() == lowerBrand && p.Name.ToLower() == lowerName);
        }

        /// <summary>
        /// A product with what saving it changes: its category, its sizes and what they include,
        /// its delivery choices and its selections.
        /// </summary>
        /// <param name="query">Products</param>
        /// <returns>The query with the editable parts included.</returns>
        public static IQueryable<Product> ForEditing(this IQueryable<Product> query) =>
            query
                .Include(p => p.Category)
                .Include(p => p.Variants)
                .ThenInclude(v => v.Components)
                .Include(p => p.DeliveryOptions)
                .Include(p => p.Options)
                .ThenInclude(o => o.Choices)
                .AsSplitQuery();
    }
}
