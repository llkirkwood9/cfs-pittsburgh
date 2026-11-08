using Microsoft.EntityFrameworkCore;
using api.Catalog;
using api.Data;
using api.Dtos;
using api.Models;
using api.Utils;

namespace api.Orders
{
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
        /// <param name="variant">The size, with its product (and its selections) and components loaded</param>
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
                    c.ComponentVariant?.Product?.Category == ProductCategory.AdjustableBase),
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

        /// <summary>
        /// The selection and choice ids sent by the dashboard.
        /// </summary>
        /// <param name="choices">The selections as sent</param>
        /// <returns>Selection id and choice id pairs.</returns>
        public static IEnumerable<(int OptionId, int ChoiceId)> PickedChoices(List<LineChoiceDto>? choices) =>
            (choices ?? [])
                .Where(c => c.OptionId != null && c.ChoiceId != null)
                .Select(c => (c.OptionId!.Value, c.ChoiceId!.Value));

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
                Category = ProductCategory.Misc,
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
            line.Category = ProductCategory.Misc;
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Copies what the sheet and stat sheet need from the product: its category and warranty.
        /// </summary>
        private static void SnapshotProduct(OrderLine line, Product product)
        {
            line.Category = product.Category;
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
