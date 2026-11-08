using Microsoft.EntityFrameworkCore;
using api.Catalog;
using api.Data;
using api.Dtos;
using api.Models;
using api.Utils;

namespace api.Orders
{
    /// <summary>
    /// What's wrong with a line's description.
    /// </summary>
    public enum DescriptionGap
    {
        /// <summary>Nothing.</summary>
        None = 0,

        /// <summary>It's blank.</summary>
        Missing = 1,

        /// <summary>It's longer than MaxDescriptionLength.</summary>
        TooLong = 2,
    }

    /// <summary>
    /// Builds order lines from the catalog. Each line snapshots what it needs from the catalog -
    /// name, size, price, warranty, the sale in force - so later catalog changes never alter an
    /// order already written.
    /// </summary>
    public static class OrderLines
    {
        #region Catalog Items

        /// <summary>
        /// A line for a catalog size, with the selections already checked. The caller sets the
        /// line type, order and position, and anything the rep typed over the catalog's wording.
        /// </summary>
        /// <param name="variant">The size, with its product (and its category and selections) and components (and theirs) loaded</param>
        /// <param name="chosen">The selections made for it</param>
        /// <param name="keyedPrice">A price the rep keyed in, used in place of the size's</param>
        /// <returns>The new line.</returns>
        public static OrderLine ForVariant(ProductVariant variant, List<LineChoice> chosen, decimal? keyedPrice)
        {
            var product = variant.Product!;
            var line = new OrderLine
            {
                ProductVariantId = variant.Id,
                Brand = product.Brand,
                Size = variant.Size,
                Description = Describe(product, variant.Configuration),
                // Any price change for a choice is added to the size's price.
                UnitPrice = (keyedPrice ?? variant.Price ?? 0m) + chosen.Sum(c => c.PriceAdjustment ?? 0m),
                ChoicesJson = Choices.ToJson(chosen),
                StockKey = Choices.KeyFor(chosen, Choices.CountedOptions(product)),
                IncludesAdjustableBase = variant.Components.Any(c =>
                    c.ComponentVariant?.Product?.Category?.StatColumn == StatColumn.AdjustableBase),
            };
            SnapshotProduct(line, product);

            // The catalog sale is taken when the item goes on the order and stays with it.
            // A size with no catalog price is sold at the price the rep keys in, so no sale.
            if (variant.Price != null)
                (line.SaleDiscountPercent, line.SaleDiscountAmount) = Choices.SaleFor(variant);

            return line;
        }

        /// <summary>
        /// A no-charge Included row for every item in a bundle, directly under the bundle line and
        /// ahead of its shipping row. Each row snapshots the component's brand, size, name and
        /// category, so it prints correctly and counts in its own stat sheet column.
        /// </summary>
        /// <param name="order">Owning order</param>
        /// <param name="parent">The bundle line</param>
        /// <param name="variant">The bundle variant, with components and their products loaded</param>
        /// <param name="choices">Each included size's selections, by component variant id</param>
        /// <returns>The rows to add.</returns>
        public static List<OrderLine> BundleComponents(Order order, OrderLine parent, ProductVariant variant,
            Dictionary<int, List<LineChoice>> choices)
        {
            var lines = new List<OrderLine>();
            foreach (var component in variant.Components.Where(c => c.ComponentVariant?.Product != null))
            {
                var item = component.ComponentVariant!;
                var product = item.Product!;
                var chosen = choices.GetValueOrDefault(item.Id) ?? [];

                var line = new OrderLine
                {
                    OrderId = order.Id,
                    LineType = OrderLineType.Included,
                    ProductVariantId = item.Id,
                    ParentLineId = parent.Id,
                    Brand = product.Brand,
                    Size = item.Size,
                    Description = Describe(product, item.Configuration),
                    Quantity = parent.Quantity * Math.Max(1, component.Quantity),
                    UnitPrice = 0m,
                    IsTaxable = false,
                    TakeWith = parent.TakeWith,
                    SortOrder = parent.SortOrder + 1,
                    ChoicesJson = Choices.ToJson(chosen),
                    StockKey = Choices.KeyFor(chosen, Choices.CountedOptions(product)),
                };
                SnapshotProduct(line, product);
                lines.Add(line);
            }
            return lines;
        }

        /// <summary>
        /// What a bundle's included items would take from stock if the bundle goes home today, so
        /// stock can be checked before the included rows exist.
        /// </summary>
        /// <param name="line">The bundle line, not yet saved</param>
        /// <param name="variant">The bundle variant, or null for anything else</param>
        /// <param name="choices">Each included size's selections, by component variant id</param>
        /// <returns>(Variant id, stock key) and quantity for each included item; none unless a Take With bundle.</returns>
        public static IEnumerable<KeyValuePair<(int VariantId, string StockKey), int>> BundleTakeWithDemand(
            OrderLine line, ProductVariant? variant, Dictionary<int, List<LineChoice>> choices)
        {
            if (!line.TakeWith || variant == null)
                return [];

            return variant.Components.Select(c => new KeyValuePair<(int, string), int>(
                (c.ComponentVariantId, IncludedStockKey(c, choices)), line.Quantity * Math.Max(1, c.Quantity)));
        }

        #endregion

        #region Delivery

        /// <summary>
        /// A delivery option of the order's territory, or null when there's no such option there.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="deliveryOptionId">The option</param>
        /// <param name="territoryId">The order's territory</param>
        /// <returns>The option, tracked, or null.</returns>
        public static async Task<DeliveryOption?> FindDeliveryOptionAsync(ApplicationDbContext db, int deliveryOptionId, int territoryId)
        {
            var option = await db.DeliveryOptions.FindAsync(deliveryOptionId);
            return option == null || option.TerritoryId != territoryId ? null : option;
        }

        /// <summary>
        /// A product's own settings for a delivery option - its price and sale for it - found from
        /// one of its sizes, or null when it doesn't list the option.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="deliveryOptionId">The delivery option</param>
        /// <param name="variantId">A size of the product, or null for no product</param>
        /// <returns>The product's entry for the option, or null.</returns>
        public static async Task<ProductDeliveryOption?> ProductDeliveryAsync(ApplicationDbContext db, int deliveryOptionId, int? variantId)
        {
            if (variantId == null)
                return null;

            return await db.ProductDeliveryOptions
                .FirstOrDefaultAsync(p => p.DeliveryOptionId == deliveryOptionId
                                          && p.ProductId == db.ProductVariants
                                              .Where(v => v.Id == variantId.Value)
                                              .Select(v => v.ProductId)
                                              .FirstOrDefault());
        }

        /// <summary>
        /// A shipping or service row. It is priced as the item it ships offers it: that product's
        /// own price and sale for the option when it has them, otherwise the option's. Take With
        /// also ticks the box on the item's row. The caller sets the position.
        /// </summary>
        /// <param name="order">Owning order</param>
        /// <param name="option">The delivery option</param>
        /// <param name="forProduct">The item's product's entry for the option, if it lists it</param>
        /// <param name="parent">The item it belongs to, if any</param>
        /// <param name="keyedPrice">A price the rep keyed in. It replaces the catalog price, and the
        /// catalog sale with it.</param>
        /// <returns>The new line.</returns>
        public static OrderLine Delivery(Order order, DeliveryOption option, ProductDeliveryOption? forProduct,
            OrderLine? parent, decimal? keyedPrice)
        {
            var line = new OrderLine
            {
                OrderId = order.Id,
                LineType = OrderLineType.Delivery,
                Category = StatColumn.Misc,
                DeliveryOptionId = option.Id,
                ParentLineId = parent?.Id,
                Description = option.Name,
                Quantity = 1,
                UnitPrice = keyedPrice ?? CatalogRules.DeliveryPrice(option, forProduct),
                IsTaxable = option.IsTaxable,
                TakeWith = option.IsTakeWith,
                ShowOnSalesSheet = option.ShowOnSalesSheet,
            };

            // The sale in force is copied onto the row, so ending it never changes this order.
            if (keyedPrice == null)
                (line.SaleDiscountPercent, line.SaleDiscountAmount) = Choices.DeliverySaleFor(option, forProduct);

            if (parent != null && option.IsTakeWith)
                parent.TakeWith = true;

            return line;
        }

        #endregion

        #region Values

        /// <summary>Longest note on a line.</summary>
        public const int MaxNotesLength = 500;

        /// <summary>
        /// Why a line's quantity, price or discount can't be used, or null when they can. A value
        /// left out (null) isn't checked.
        /// </summary>
        /// <param name="quantity">Quantity, at least 1</param>
        /// <param name="unitPrice">Unit price, 0 or more</param>
        /// <param name="discountPercent">Percent off, 0 to 100</param>
        /// <param name="discountAmount">Amount off, 0 or more</param>
        /// <returns>A message for the rep, or null.</returns>
        public static string? ValuesProblem(int? quantity, decimal? unitPrice, decimal? discountPercent, decimal? discountAmount)
        {
            if (quantity is < 1)
                return "The quantity must be at least 1.";

            if (unitPrice is < 0)
                return "The unit price cannot be negative.";

            if (discountPercent is < 0 or > 100)
                return "The discount must be between 0 and 100 percent.";

            if (discountAmount is < 0)
                return "A discount can't be negative.";

            return null;
        }

        /// <summary>
        /// Sets a line's own discount. One discount style per line: a percent above 0 wins and
        /// clears the amount; otherwise the amount is kept, and 0 means no discount.
        /// </summary>
        /// <param name="line">The line</param>
        /// <param name="percent">Percent off, already checked</param>
        /// <param name="amount">Amount off, already checked</param>
        public static void SetDiscount(OrderLine line, decimal? percent, decimal? amount)
        {
            if (percent is > 0)
            {
                line.DiscountPercent = percent;
                line.DiscountAmount = null;
            }
            else
            {
                line.DiscountPercent = null;
                line.DiscountAmount = amount == 0 ? null : amount;
            }
        }

        /// <summary>Longest description on a line.</summary>
        public const int MaxDescriptionLength = 300;

        /// <summary>
        /// What's wrong with a line's description, if anything: missing (blank) or too long.
        /// </summary>
        /// <param name="description">The description as typed</param>
        /// <param name="storedTrimmed">Whether it is stored trimmed (an upcharge's reason), so
        /// only the trimmed text counts toward the limit</param>
        /// <returns>What's wrong, or None.</returns>
        public static DescriptionGap DescriptionProblem(string? description, bool storedTrimmed = false)
        {
            if (string.IsNullOrWhiteSpace(description))
                return DescriptionGap.Missing;

            var length = storedTrimmed ? description.Trim().Length : description.Length;
            return length > MaxDescriptionLength ? DescriptionGap.TooLong : DescriptionGap.None;
        }

        /// <summary>
        /// Why a line's note can't be saved, or null when it can.
        /// </summary>
        /// <param name="notes">The note as typed</param>
        /// <returns>A message for the rep, or null.</returns>
        public static string? NotesProblem(string? notes) =>
            notes is { Length: > MaxNotesLength } ? "An item note can be at most 500 characters." : null;

        /// <summary>
        /// A line's note as stored: trimmed, nothing when blank.
        /// </summary>
        /// <param name="notes">The note as typed</param>
        /// <returns>The note, or null.</returns>
        public static string? CleanNotes(string? notes) =>
            string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

        #endregion

        #region Upcharges

        /// <summary>
        /// An upcharge is only a reason and an amount per item: it carries no discount, note or
        /// Take With of its own. Its quantity and tax follow its item when the order is totalled.
        /// </summary>
        /// <param name="line">The upcharge line</param>
        public static void KeepUpchargePlain(OrderLine line)
        {
            line.DiscountPercent = null;
            line.DiscountAmount = null;
            line.SaleDiscountPercent = null;
            line.SaleDiscountAmount = null;
            line.TakeWith = false;
            line.Notes = null;
            line.Category = StatColumn.Misc;
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Copies what the sheet and stat sheet need from the product: the stat-sheet column its
        /// category counts in, and its warranty. The product comes with its category loaded.
        /// </summary>
        private static void SnapshotProduct(OrderLine line, Product product)
        {
            line.Category = product.Category?.StatColumn
                            ?? throw new InvalidOperationException("The product was loaded without its category.");
            line.HasWarranty = product.HasWarranty;
            line.WarrantyLength = product.HasWarranty ? product.WarrantyLength : null;
        }

        /// <summary>
        /// The Description cell for a catalog size, e.g. "Agility 3000 - IMC61 Adjustable".
        /// </summary>
        private static string Describe(Product? product, string? configuration)
        {
            var name = product?.Name ?? "Item";
            return string.IsNullOrWhiteSpace(configuration) ? name : $"{name} - {configuration}";
        }

        /// <summary>
        /// The stock an included item draws from, from the selections picked for it.
        /// </summary>
        private static string IncludedStockKey(ProductVariantComponent component, Dictionary<int, List<LineChoice>> choices)
        {
            var product = component.ComponentVariant?.Product;
            return product == null
                ? ""
                : Choices.KeyFor(choices.GetValueOrDefault(component.ComponentVariantId) ?? [], Choices.CountedOptions(product));
        }

        #endregion
    }
}
