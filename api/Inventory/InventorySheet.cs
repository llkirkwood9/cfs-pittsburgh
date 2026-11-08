using api.Catalog;
using api.Data;
using api.Dtos;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Inventory
{
    /// <summary>
    /// A territory's inventory as the Inventory screen and the event's Accessory Inventory Sheet
    /// show it: one row per tracked size and combination of counted choices.
    /// </summary>
    public static class InventorySheet
    {
        #region Public Methods

        /// <summary>
        /// Builds a territory's inventory rows for every active tracked size in its catalog, or for
        /// a single size. Sizes left out of their product's inventory are skipped.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="territoryId">The territory whose stock to show</param>
        /// <param name="eventId">Optional event for the sold-at-event totals</param>
        /// <param name="variantId">Optional single variant</param>
        /// <returns>Inventory rows in catalog order.</returns>
        public static async Task<List<InventoryItemDto>> LoadItemsAsync(ApplicationDbContext db, int territoryId, int? eventId, int? variantId)
        {
            var query = db.ProductVariants
                .AsNoTracking()
                .Include(v => v.Product)
                .ThenInclude(p => p!.Options)
                .ThenInclude(o => o.Choices)
                .Include(v => v.Product)
                .ThenInclude(p => p!.Category)
                .AsSplitQuery()
                .Where(InventoryRules.Tracked)
                .Where(v => v.Product!.TerritoryId == territoryId);

            query = variantId != null
                ? query.Where(v => v.Id == variantId.Value)
                : query.Where(v => v.IsActive && v.Product!.IsActive);

            var variants = await query.ToListAsync();
            var ids = variants.Select(v => v.Id).ToList();
            var onHand = await InventoryRules.OnHandAsync(db, territoryId, ids);

            var lastChanged = await db.InventoryAdjustments
                .Where(a => a.TerritoryId == territoryId && ids.Contains(a.ProductVariantId))
                .GroupBy(a => new { a.ProductVariantId, a.StockKey })
                .Select(g => new { g.Key.ProductVariantId, g.Key.StockKey, At = g.Max(a => a.CreatedAt) })
                .ToListAsync();

            var sold = eventId == null
                ? []
                : await db.InventoryAdjustments
                    .Where(a => a.EventId == eventId
                                && ids.Contains(a.ProductVariantId)
                                && (a.Kind == InventoryChangeKind.Sale || a.Kind == InventoryChangeKind.Return))
                    .GroupBy(a => new { a.ProductVariantId, a.StockKey })
                    .Select(g => new { g.Key.ProductVariantId, g.Key.StockKey, Net = g.Sum(a => a.Change) })
                    .ToListAsync();

            // The latest start and end shelf counts taken at the event, per size and combination.
            var shelfCounts = eventId == null
                ? []
                : await db.InventoryAdjustments
                    .AsNoTracking()
                    .Where(a => a.EventId == eventId
                                && ids.Contains(a.ProductVariantId)
                                && (a.Kind == InventoryChangeKind.Count || a.Kind == InventoryChangeKind.OpeningCount))
                    .ToListAsync();

            InventoryAdjustment? Latest(int id, string key, InventoryChangeKind kind) => shelfCounts
                .Where(a => a.ProductVariantId == id && a.StockKey == key && a.Kind == kind)
                .OrderByDescending(a => a.CreatedAt)
                .ThenByDescending(a => a.Id)
                .FirstOrDefault();

            var rows = new List<InventoryItemDto>();
            foreach (var v in variants
                         .OrderBy(v => v.Product!.Category!.SortOrder)
                         .ThenBy(v => v.Product!.Category!.Name)
                         .ThenBy(v => v.Product!.SortOrder)
                         .ThenBy(v => v.Product!.Name)
                         .ThenBy(v => v.SortOrder))
            {
                // One row per combination of counted choices (just one, with the empty key, when
                // nothing is counted that way). Leftover counts - from a choice or selection since
                // retired, or stock counted before choices were - get a row too while any remain,
                // so they can be counted away.
                var combinations = Choices.Combinations(v.Product!);
                var keys = combinations.ToList();
                foreach (var extra in onHand.Where(x => x.Key.VariantId == v.Id && x.Value != 0 && x.Key.StockKey != ""
                                                        && keys.All(k => k.Key != x.Key.StockKey)))
                    keys.Add((extra.Key.StockKey, Choices.LabelFor(v.Product!, extra.Key.StockKey) + " (no longer offered)"));
                if (keys.All(k => k.Key != "") && onHand.GetValueOrDefault((v.Id, "")) != 0)
                    keys.Add(("", "Not split by choice"));

                foreach (var (key, label) in keys)
                {
                    var opening = Latest(v.Id, key, InventoryChangeKind.OpeningCount);
                    var closing = Latest(v.Id, key, InventoryChangeKind.Count);
                    rows.Add(new InventoryItemDto
                    {
                        ProductVariantId = v.Id,
                        ProductId = v.ProductId,
                        ProductName = v.Product!.Name,
                        Brand = v.Product.Brand,
                        Category = v.Product.Category!.Name,
                        Size = v.Size,
                        Configuration = v.Configuration,
                        StockKey = key,
                        Choices = label,
                        QuantityOnHand = onHand.GetValueOrDefault((v.Id, key)),
                        SoldAtEvent = eventId == null ? null : -(sold.FirstOrDefault(x => x.ProductVariantId == v.Id && x.StockKey == key)?.Net ?? 0),
                        OpeningCountAtEvent = opening?.QuantityAfter,
                        OpeningCountedAt = opening?.CreatedAt,
                        OpeningCountedBy = opening?.UserName,
                        CountedAt = closing?.CreatedAt,
                        CountedBy = closing?.UserName,
                        CountedAtEvent = closing?.QuantityAfter,
                        ExpectedAtCount = closing == null ? null : closing.QuantityAfter - closing.Change,
                        LastChangedAt = lastChanged.FirstOrDefault(x => x.ProductVariantId == v.Id && x.StockKey == key)?.At,
                    });
                }
            }

            return rows;
        }

        #endregion
    }
}
