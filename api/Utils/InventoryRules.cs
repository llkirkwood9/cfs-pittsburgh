using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Utils
{
    /// <summary>
    /// Stock rules for Take With sales. A tracked item can only go home with the customer when the
    /// cart has enough of it, and a size left out of inventory - not kept at the cart - never can;
    /// otherwise it has to be shipped. Stock is drawn down when the sale is
    /// completed and put back if a completed sale is reopened or voided. Stock is kept per size,
    /// or per size and combination of choices for selections that count stock (such as sheet
    /// colors), so each demand is keyed by both.
    /// </summary>
    public static class InventoryRules
    {
        #region Public Methods

        /// <summary>
        /// Copies each bundle line's Take With box onto its included items, since anything in the
        /// bundle leaves the building the same way the bundle does.
        /// </summary>
        /// <param name="order">Order with its lines loaded</param>
        public static void SyncIncludedTakeWith(Order order)
        {
            foreach (var included in order.Lines.Where(l => l.LineType == OrderLineType.Included))
            {
                var parent = order.Lines.FirstOrDefault(l => l.Id == included.ParentLineId);
                if (parent != null)
                    included.TakeWith = parent.TakeWith;
            }
        }

        /// <summary>
        /// Units the order sends home as Take With, by size and combination of choices.
        /// </summary>
        /// <param name="lines">Order lines</param>
        /// <returns>(Variant id, stock key) to quantity.</returns>
        public static Dictionary<(int VariantId, string StockKey), int> TakeWithDemand(IEnumerable<OrderLine> lines)
        {
            return lines
                .Where(l => l.TakeWith
                            && l.ProductVariantId != null
                            && l.LineType is OrderLineType.Product or OrderLineType.Included)
                .GroupBy(l => (l.ProductVariantId!.Value, l.StockKey ?? ""))
                .ToDictionary(g => g.Key, g => g.Sum(l => l.Quantity));
        }

        /// <summary>
        /// Checks that every tracked Take With item on the order is in stock.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="lines">Order lines, including any not yet saved</param>
        /// <param name="extra">Additional demand not yet on the order, such as a bundle's items</param>
        /// <returns>A message for the rep when something is short, otherwise null.</returns>
        public static async Task<string?> CheckStockAsync(
            ApplicationDbContext db,
            IEnumerable<OrderLine> lines,
            IEnumerable<KeyValuePair<(int VariantId, string StockKey), int>>? extra = null)
        {
            var demand = TakeWithDemand(lines);
            foreach (var (key, quantity) in extra ?? [])
                demand[key] = demand.GetValueOrDefault(key) + quantity;

            if (demand.Count == 0)
                return null;

            var ids = demand.Keys.Select(k => k.VariantId).Distinct().ToList();

            // A size left out of inventory isn't kept at the cart, so it can't go home today.
            var notKept = await db.ProductVariants
                .Include(v => v.Product)
                .ThenInclude(p => p!.Options)
                .ThenInclude(o => o.Choices)
                .Where(v => ids.Contains(v.Id) && v.Product!.TrackInventory && v.ExcludeFromInventory)
                .FirstOrDefaultAsync();
            if (notKept != null)
                return $"{Describe(notKept, "")} isn't kept at the cart, so it cannot be a Take With. Choose a shipping method instead.";

            var tracked = await LoadTrackedAsync(db, ids);

            foreach (var ((variantId, key), wanted) in demand)
            {
                var variant = tracked.FirstOrDefault(v => v.Id == variantId);
                if (variant == null)
                    continue;

                var onHand = await Choices.OnHandAsync(db, variant, key);
                if (wanted <= onHand)
                    continue;

                var name = Describe(variant, key);
                return onHand <= 0
                    ? $"{name} is out of stock, so it cannot be a Take With. Choose a shipping method instead."
                    : $"Only {onHand} of {name} in stock for Take With. Lower the quantity or choose a shipping method.";
            }

            return null;
        }

        /// <summary>
        /// Whether a size is left out of its tracked product's inventory - not kept at the cart, so
        /// it can't be a Take With.
        /// </summary>
        /// <param name="variant">The size, with its product loaded; null for anything else</param>
        /// <returns>True when it isn't kept at the cart.</returns>
        public static bool NotKept(ProductVariant? variant) =>
            variant is { ExcludeFromInventory: true, Product.TrackInventory: true };

        /// <summary>
        /// Draws the order's tracked Take With items out of stock and records each change.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="order">The order being completed</param>
        /// <param name="userId">Crew member completing it</param>
        /// <param name="userName">Their name</param>
        public static async Task DeductForSaleAsync(ApplicationDbContext db, Order order, int? userId, string? userName)
        {
            var demand = TakeWithDemand(order.Lines);
            if (demand.Count == 0)
                return;

            var ids = demand.Keys.Select(k => k.VariantId).Distinct().ToList();
            var tracked = await LoadTrackedAsync(db, ids);

            foreach (var ((variantId, key), quantity) in demand)
            {
                var variant = tracked.FirstOrDefault(v => v.Id == variantId);
                if (variant == null)
                    continue;

                var after = await Choices.ChangeAsync(db, variant, key, -quantity);

                db.InventoryAdjustments.Add(new InventoryAdjustment
                {
                    ProductVariantId = variant.Id,
                    StockKey = key,
                    Kind = InventoryChangeKind.Sale,
                    Change = -quantity,
                    QuantityAfter = after,
                    OrderId = order.Id,
                    EventId = order.EventId,
                    UserId = userId,
                    UserName = userName,
                    Note = $"Order #{order.OrderNumber}",
                });
            }
        }

        /// <summary>
        /// Puts back whatever a completed sale drew out of stock, when that sale is reopened or
        /// voided. Works from the recorded changes, so it returns exactly what was taken even if
        /// the order or the catalog has changed since.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="order">The order being reopened or voided</param>
        /// <param name="userId">Crew member making the change</param>
        /// <param name="userName">Their name</param>
        /// <param name="reason">What happened to the order, e.g. "reopened" or "voided"</param>
        public static async Task RestoreForOrderAsync(
            ApplicationDbContext db, Order order, int? userId, string? userName, string reason)
        {
            var outstanding = await db.InventoryAdjustments
                .Where(a => a.OrderId == order.Id
                            && (a.Kind == InventoryChangeKind.Sale || a.Kind == InventoryChangeKind.Return))
                .GroupBy(a => new { a.ProductVariantId, a.StockKey })
                .Select(g => new { g.Key.ProductVariantId, g.Key.StockKey, Net = g.Sum(a => a.Change) })
                .Where(x => x.Net < 0)
                .ToListAsync();

            if (outstanding.Count == 0)
                return;

            var ids = outstanding.Select(x => x.ProductVariantId).Distinct().ToList();
            var variants = await db.ProductVariants.Where(v => ids.Contains(v.Id)).ToListAsync();

            foreach (var x in outstanding)
            {
                var variant = variants.FirstOrDefault(v => v.Id == x.ProductVariantId);
                if (variant == null)
                    continue;

                var quantity = -x.Net;
                var after = await Choices.ChangeAsync(db, variant, x.StockKey, quantity);

                db.InventoryAdjustments.Add(new InventoryAdjustment
                {
                    ProductVariantId = variant.Id,
                    StockKey = x.StockKey,
                    Kind = InventoryChangeKind.Return,
                    Change = quantity,
                    QuantityAfter = after,
                    OrderId = order.Id,
                    EventId = order.EventId,
                    UserId = userId,
                    UserName = userName,
                    Note = $"Order #{order.OrderNumber} {reason}",
                });
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// The tracked sizes among some variant ids, with their product's selections loaded. A size
        /// left out of its product's inventory is not tracked.
        /// </summary>
        private static Task<List<ProductVariant>> LoadTrackedAsync(ApplicationDbContext db, List<int> ids) =>
            db.ProductVariants
                .Include(v => v.Product)
                .ThenInclude(p => p!.Options)
                .ThenInclude(o => o.Choices)
                .Where(v => ids.Contains(v.Id) && v.Product!.TrackInventory && !v.ExcludeFromInventory)
                .ToListAsync();

        /// <summary>
        /// A short name for a variant in a message, e.g. "Luxury Sheets - Queen (Gray)".
        /// </summary>
        /// <param name="variant">Variant with its product (and its selections) loaded</param>
        /// <param name="key">The stock key</param>
        /// <returns>The name.</returns>
        private static string Describe(ProductVariant variant, string key)
        {
            var name = variant.Product?.Name ?? "This item";
            if (!string.IsNullOrWhiteSpace(variant.Size))
                name = $"{name} - {variant.Size}";
            var label = variant.Product == null ? "" : Choices.LabelFor(variant.Product, key);
            return label.Length == 0 ? name : $"{name} ({label})";
        }

        #endregion
    }
}
