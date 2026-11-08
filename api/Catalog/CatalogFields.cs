using api.Models;

namespace api.Catalog
{
    /// <summary>
    /// Copies the fields of a size and of a product's delivery choice from what the product editor
    /// or a catalog file sends, the same way for both. A catalog file then trims a size's names
    /// and puts its sizes in file order (CatalogTransfer).
    /// </summary>
    public static class CatalogFields
    {
        /// <summary>
        /// Copies a size's fields onto a new or existing size.
        /// </summary>
        /// <param name="variant">Target size</param>
        /// <param name="size">Size, e.g. "Queen"; nothing for none</param>
        /// <param name="configuration">Configuration; blank for none</param>
        /// <param name="price">Price, or null for an "Inquire" size</param>
        /// <param name="sortOrder">Position among the product's sizes</param>
        /// <param name="isActive">Whether it's offered (default yes)</param>
        /// <param name="excludeFromInventory">Whether it's left out of inventory (default no)</param>
        /// <param name="notes">Note on the size</param>
        /// <param name="hasOwnSale">Whether it has a sale of its own rather than the product's</param>
        /// <param name="salePercent">Its own sale, percent off</param>
        /// <param name="saleAmount">Its own sale, amount off</param>
        public static void CopySize(ProductVariant variant, string? size, string? configuration, decimal? price, int sortOrder,
            bool? isActive, bool? excludeFromInventory, string? notes, bool? hasOwnSale, decimal? salePercent, decimal? saleAmount)
        {
            variant.Size = size ?? string.Empty;
            variant.Configuration = string.IsNullOrWhiteSpace(configuration) ? null : configuration;
            variant.Price = price;
            variant.SortOrder = sortOrder;
            variant.IsActive = isActive ?? true;
            variant.ExcludeFromInventory = excludeFromInventory ?? false;
            variant.Notes = CatalogRules.CleanSizeNotes(notes);
            variant.HasOwnSale = hasOwnSale ?? false;
            (variant.SaleDiscountPercent, variant.SaleDiscountAmount) = variant.HasOwnSale
                ? CatalogRules.CleanSale(salePercent, saleAmount)
                : (null, null);
        }

        /// <summary>
        /// A product's entry for a delivery option, with its own price and sale. The caller points
        /// it at the option.
        /// </summary>
        /// <param name="priceOverride">The product's own price for the option, or null for the option's</param>
        /// <param name="isDefault">Whether it's the product's default choice</param>
        /// <param name="hasOwnSale">Whether it has a sale of its own rather than the option's</param>
        /// <param name="salePercent">Its own sale, percent off</param>
        /// <param name="saleAmount">Its own sale, amount off</param>
        /// <returns>The new entry.</returns>
        public static ProductDeliveryOption NewDeliveryChoice(decimal? priceOverride, bool? isDefault, bool? hasOwnSale,
            decimal? salePercent, decimal? saleAmount)
        {
            var ownSale = hasOwnSale ?? false;
            var (percent, amount) = ownSale ? CatalogRules.CleanSale(salePercent, saleAmount) : (null, null);
            return new ProductDeliveryOption
            {
                PriceOverride = priceOverride,
                IsDefault = isDefault ?? false,
                HasOwnSale = ownSale,
                SaleDiscountPercent = percent,
                SaleDiscountAmount = amount,
            };
        }
    }
}
