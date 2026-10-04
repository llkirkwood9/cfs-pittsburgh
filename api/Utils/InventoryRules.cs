using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Utils
{
    /// <summary>
    /// Stock rules for Take With sales. A tracked item can only go home with the customer when the
    /// cart has enough of it; otherwise it has to be shipped. Stock is kept per territory - each
    /// territory's cart carries its own, even of global catalog items - and is drawn down when the
    /// sale is completed and put back if a completed sale is reopened or voided.
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
        /// Units of each variant the order sends home as Take With.
        /// </summary>
        /// <param name="lines">Order lines</param>
        /// <returns>Variant id to quantity.</returns>
        public static Dictionary<int, int> TakeWithDemand(IEnumerable<OrderLine> lines)
        {
            return lines
                .Where(l => l.TakeWith
                            && l.ProductVariantId != null
                            && l.LineType is OrderLineType.Product or OrderLineType.Included)
                .GroupBy(l => l.ProductVariantId!.Value)
                .ToDictionary(g => g.Key, g => g.Sum(l => l.Quantity));
        }

        /// <summary>
        /// A territory's on-hand counts for some sizes. A size it has never counted has none.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="territoryId">The territory</param>
        /// <param name="variantIds">The sizes</param>
        /// <returns>Variant id to units on hand.</returns>
        public static async Task<Dictionary<int, int>> OnHandAsync(ApplicationDbContext db, int territoryId, IReadOnlyCollection<int> variantIds)
        {
            return await db.InventoryStocks.AsNoTracking()
                .Where(s => s.TerritoryId == territoryId && variantIds.Contains(s.ProductVariantId))
                .ToDictionaryAsync(s => s.ProductVariantId, s => s.QuantityOnHand);
        }

        /// <summary>
        /// The tracked stock row for a size in a territory, created at zero if it has none yet.
        /// The caller saves.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="territoryId">The territory</param>
        /// <param name="variantId">The size</param>
        /// <returns>The row, tracked.</returns>
        public static async Task<InventoryStock> StockRowAsync(ApplicationDbContext db, int territoryId, int variantId)
        {
            var row = db.InventoryStocks.Local.FirstOrDefault(s => s.TerritoryId == territoryId && s.ProductVariantId == variantId)
                      ?? await db.InventoryStocks.FirstOrDefaultAsync(s => s.TerritoryId == territoryId && s.ProductVariantId == variantId);
            if (row == null)
            {
                row = new InventoryStock { TerritoryId = territoryId, ProductVariantId = variantId, QuantityOnHand = 0 };
                db.InventoryStocks.Add(row);
            }
            return row;
        }

        /// <summary>
        /// Checks that every tracked Take With item on the order is in stock in the territory.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="territoryId">The order's territory</param>
        /// <param name="lines">Order lines, including any not yet saved</param>
        /// <param name="extra">Additional demand not yet on the order, such as a bundle's items</param>
        /// <returns>A message for the rep when something is short, otherwise null.</returns>
        public static async Task<string?> CheckStockAsync(
            ApplicationDbContext db,
            int territoryId,
            IEnumerable<OrderLine> lines,
            IEnumerable<KeyValuePair<int, int>>? extra = null)
        {
            var demand = TakeWithDemand(lines);
            foreach (var (variantId, quantity) in extra ?? [])
                demand[variantId] = demand.GetValueOrDefault(variantId) + quantity;

            if (demand.Count == 0)
                return null;

            var ids = demand.Keys.ToList();
            var tracked = await db.ProductVariants
                .Include(v => v.Product)
                .Where(v => ids.Contains(v.Id) && v.Product!.TrackInventory)
                .ToListAsync();
            var onHand = await OnHandAsync(db, territoryId, ids);

            foreach (var variant in tracked)
            {
                var wanted = demand[variant.Id];
                var have = onHand.GetValueOrDefault(variant.Id);
                if (wanted <= have)
                    continue;

                var name = Describe(variant);
                return have <= 0
                    ? $"{name} is out of stock, so it cannot be a Take With. Choose a shipping method instead."
                    : $"Only {have} of {name} in stock for Take With. Lower the quantity or choose a shipping method.";
            }

            return null;
        }

        /// <summary>
        /// Draws the order's tracked Take With items out of its territory's stock and records each
        /// change.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="order">The order being completed</param>
        /// <param name="territoryId">The order's territory</param>
        /// <param name="userId">Crew member completing it</param>
        /// <param name="userName">Their name</param>
        public static async Task DeductForSaleAsync(ApplicationDbContext db, Order order, int territoryId, int? userId, string? userName)
        {
            var demand = TakeWithDemand(order.Lines);
            if (demand.Count == 0)
                return;

            var ids = demand.Keys.ToList();
            var tracked = await db.ProductVariants
                .Where(v => ids.Contains(v.Id) && v.Product!.TrackInventory)
                .Select(v => v.Id)
                .ToListAsync();

            foreach (var variantId in tracked)
            {
                var quantity = demand[variantId];
                var stock = await StockRowAsync(db, territoryId, variantId);
                stock.QuantityOnHand -= quantity;

                db.InventoryAdjustments.Add(new InventoryAdjustment
                {
                    TerritoryId = territoryId,
                    ProductVariantId = variantId,
                    Kind = InventoryChangeKind.Sale,
                    Change = -quantity,
                    QuantityAfter = stock.QuantityOnHand,
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
        /// voided. Works from the recorded changes, so it returns exactly what was taken, to the
        /// territory it was taken from, even if the order or the catalog has changed since.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="order">The order being reopened or voided</param>
        /// <param name="territoryId">The order's territory, for changes recorded before territories</param>
        /// <param name="userId">Crew member making the change</param>
        /// <param name="userName">Their name</param>
        /// <param name="reason">What happened to the order, e.g. "reopened" or "voided"</param>
        public static async Task RestoreForOrderAsync(
            ApplicationDbContext db, Order order, int territoryId, int? userId, string? userName, string reason)
        {
            var outstanding = await db.InventoryAdjustments
                .Where(a => a.OrderId == order.Id
                            && (a.Kind == InventoryChangeKind.Sale || a.Kind == InventoryChangeKind.Return))
                .GroupBy(a => new { a.ProductVariantId, a.TerritoryId })
                .Select(g => new { g.Key.ProductVariantId, g.Key.TerritoryId, Net = g.Sum(a => a.Change) })
                .Where(x => x.Net < 0)
                .ToListAsync();

            foreach (var item in outstanding)
            {
                var quantity = -item.Net;
                var into = item.TerritoryId ?? territoryId;
                var stock = await StockRowAsync(db, into, item.ProductVariantId);
                stock.QuantityOnHand += quantity;

                db.InventoryAdjustments.Add(new InventoryAdjustment
                {
                    TerritoryId = into,
                    ProductVariantId = item.ProductVariantId,
                    Kind = InventoryChangeKind.Return,
                    Change = quantity,
                    QuantityAfter = stock.QuantityOnHand,
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
        /// A short name for a variant in a message, e.g. "SoftCell Chill (2.0) - King".
        /// </summary>
        /// <param name="variant">Variant with its product loaded</param>
        /// <returns>The name.</returns>
        private static string Describe(ProductVariant variant)
        {
            var name = variant.Product?.Name ?? "This item";
            return string.IsNullOrWhiteSpace(variant.Size) ? name : $"{name} - {variant.Size}";
        }

        #endregion
    }
}
