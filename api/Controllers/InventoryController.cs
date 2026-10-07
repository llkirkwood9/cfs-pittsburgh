using System.Diagnostics;
using api.Data;
using api.Dtos;
using api.Models;
using api.Services;
using api.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    /// <summary>
    /// On-hand stock for the accessories kept at the cart, per territory. Only products marked
    /// Track inventory - global ones and the territory's own - appear here. Counts are changed by
    /// the checkout team, managers and administrators; Take With sales draw them down
    /// automatically when an order is completed.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class InventoryController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region Private Fields

        private const string CannotUpdate = "Only checkout, managers and administrators may change inventory.";

        private const string PickTerritory = "Pick a territory first - each territory keeps its own stock.";

        #endregion

        #region POST Methods

        /// <summary>
        /// Changes the on-hand count of one tracked size in the territory being worked, either by
        /// an amount or to a counted total.
        /// </summary>
        /// <param name="request">Variant id plus Change or SetTo, and an optional note</param>
        /// <returns>The updated inventory row.</returns>
        [HttpPost("adjust")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AdjustInventory([FromBody] InventoryAdjustmentDto request)
        {
            try
            {
                if (!CanUpdateInventory())
                    return Forbidden(CannotUpdate);

                var territoryId = Scope.TerritoryId;
                if (territoryId == null)
                    return BadRequest(new { error = PickTerritory });

                if (request.ProductVariantId == null || (request.Change == null) == (request.SetTo == null))
                    return BadRequest(new { error = "Missing parameter." });

                if (request.Note is { Length: > 300 } || request.SetTo is < 0 or > 100_000 || request.Change is < -100_000 or > 100_000)
                    return BadRequest(new { error = "Invalid parameter." });

                var variant = await DB.ProductVariants
                    .Include(v => v.Product)
                    .FirstOrDefaultAsync(v => v.Id == request.ProductVariantId.Value);

                if (variant?.Product == null || !InTerritoryCatalog(variant.Product, territoryId.Value))
                    return NotFound(new { error = "Product not found." });

                if (!variant.Product.TrackInventory)
                    return BadRequest(new { error = "This product does not track inventory." });

                var key = request.StockKey ?? "";
                var stock = await InventoryRules.StockRowAsync(DB, territoryId.Value, variant.Id, key);
                var change = request.SetTo != null
                    ? request.SetTo.Value - stock.QuantityOnHand
                    : request.Change!.Value;

                if (stock.QuantityOnHand + change < 0)
                    return BadRequest(new { error = "The count cannot go below zero." });

                if (change == 0)
                    return Ok(await LoadItemAsync(territoryId.Value, variant.Id, key));

                stock.QuantityOnHand += change;

                DB.InventoryAdjustments.Add(new InventoryAdjustment
                {
                    TerritoryId = territoryId,
                    ProductVariantId = variant.Id,
                    StockKey = key,
                    Kind = InventoryChangeKind.Adjustment,
                    Change = change,
                    QuantityAfter = stock.QuantityOnHand,
                    UserId = GetCurrentUserId(),
                    UserName = GetCurrentUserName(),
                    Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
                });

                await DB.SaveChangesAsync();

                return Ok(await LoadItemAsync(territoryId.Value, variant.Id, key));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while updating inventory.", e);
            }
        }

        /// <summary>
        /// Saves a shelf count for an event - the start-of-event count before the doors open, or
        /// the end-of-event count once they close - in the event's territory. Each counted size is
        /// set to what was found, and a row is recorded for it - even when it matched - so the
        /// event's inventory sheet shows what the event started with, what was expected at the end
        /// and what was on the shelf.
        /// </summary>
        /// <param name="request">Event id, phase, optional note and the counted sizes</param>
        /// <returns>The event's inventory rows after the count.</returns>
        [HttpPost("count")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> SaveCount([FromBody] InventoryCountDto request)
        {
            try
            {
                if (!CanUpdateInventory())
                    return Forbidden(CannotUpdate);

                if (request.EventId == null || request.Counts == null || request.Counts.Count == 0)
                    return BadRequest(new { error = "Missing parameter." });

                if (request.Note is { Length: > 300 } || request.Counts.Count > 2000)
                    return BadRequest(new { error = "Invalid parameter." });

                if (request.Counts.Any(c => c.ProductVariantId == null || c.Counted is null or < 0 or > 100_000))
                    return BadRequest(new { error = "Every count must be a whole number, 0 or more." });

                var saleEvent = await DB.Events.FindAsync(request.EventId.Value);
                if (saleEvent == null || !CanSee(saleEvent))
                    return NotFound(new { error = "Event not found." });
                var territoryId = saleEvent.TerritoryId;

                // The last entry for a size (and combination of choices) wins if it was sent twice.
                var counts = request.Counts
                    .GroupBy(c => (c.ProductVariantId!.Value, c.StockKey ?? ""))
                    .ToDictionary(g => g.Key, g => g.Last().Counted!.Value);

                var ids = counts.Keys.Select(k => k.Item1).Distinct().ToList();
                var variants = await DB.ProductVariants
                    .Include(v => v.Product)
                    .Where(v => ids.Contains(v.Id))
                    .ToListAsync();

                if (variants.Count != ids.Count
                    || variants.Any(v => v.Product is not { TrackInventory: true } || !InTerritoryCatalog(v.Product, territoryId)))
                    return BadRequest(new { error = "Only this territory's tracked products can be counted." });

                var opening = string.Equals(request.Phase, "Start", StringComparison.OrdinalIgnoreCase);
                var kind = opening ? InventoryChangeKind.OpeningCount : InventoryChangeKind.Count;
                var note = string.IsNullOrWhiteSpace(request.Note)
                    ? opening ? "Start-of-event count" : "End-of-event count"
                    : request.Note.Trim();
                var now = DateTime.UtcNow;

                foreach (var ((variantId, key), counted) in counts)
                {
                    var variant = variants.First(v => v.Id == variantId);
                    var stock = await InventoryRules.StockRowAsync(DB, territoryId, variant.Id, key);
                    var change = counted - stock.QuantityOnHand;
                    stock.QuantityOnHand = counted;

                    DB.InventoryAdjustments.Add(new InventoryAdjustment
                    {
                        TerritoryId = territoryId,
                        ProductVariantId = variant.Id,
                        StockKey = key,
                        Kind = kind,
                        Change = change,
                        QuantityAfter = counted,
                        EventId = request.EventId,
                        UserId = GetCurrentUserId(),
                        UserName = GetCurrentUserName(),
                        Note = note,
                        CreatedAt = now,
                    });
                }

                await DB.SaveChangesAsync();

                return Ok(await LoadItemsAsync(DB, territoryId, request.EventId, null));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while saving the count.", e);
            }
        }

        #endregion

        #region PUT Methods

        /// <summary>
        /// Saves the notes printed in the Notes box of an event's Accessory Inventory Sheet.
        /// </summary>
        /// <param name="eventId">Event id</param>
        /// <param name="request">The notes; empty clears them</param>
        /// <returns>The saved notes.</returns>
        [HttpPut("notes/event/{eventId}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> SaveInventoryNotes(int eventId, [FromBody] InventoryNotesDto request)
        {
            try
            {
                if (!CanUpdateInventory())
                    return Forbidden(CannotUpdate);

                if (request.Notes is { Length: > 2000 })
                    return BadRequest(new { error = "The notes can be at most 2,000 characters." });

                var saleEvent = await DB.Events.FindAsync(eventId);
                if (saleEvent == null || !CanSee(saleEvent))
                    return NotFound(new { error = "Event not found." });

                saleEvent.InventoryNotes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
                await DB.SaveChangesAsync();

                return Ok(new InventoryNotesDto { EventId = saleEvent.Id, Notes = saleEvent.InventoryNotes });
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while saving the notes.", e);
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists every tracked size with its on-hand count in a territory: the event's, when an
        /// event is given, otherwise the territory being worked. A system admin or administrator looking at
        /// every territory gets an empty list - stock only makes sense for one.
        /// </summary>
        /// <param name="eventId">Optional event, to include what its Take With sales used</param>
        /// <returns>Inventory rows in catalog order.</returns>
        [HttpGet("items")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetInventory([FromQuery] int? eventId = null)
        {
            try
            {
                int? territoryId = Scope.TerritoryId;
                if (eventId != null)
                {
                    var saleEvent = await DB.Events.AsNoTracking().FirstOrDefaultAsync(e => e.Id == eventId.Value);
                    if (saleEvent == null || !CanSee(saleEvent))
                        return NotFound(new { error = "Event not found." });
                    territoryId = saleEvent.TerritoryId;
                }

                if (territoryId == null)
                    return Ok(new List<InventoryItemDto>());

                return Ok(await LoadItemsAsync(DB, territoryId.Value, eventId, null));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting inventory.", e);
            }
        }

        /// <summary>
        /// Recent changes to one size's count in the territory being worked, newest first.
        /// </summary>
        /// <param name="id">Variant id</param>
        /// <param name="stockKey">Which combination of counted choices; empty for stock kept per size</param>
        /// <param name="take">How many rows to return, at most 200</param>
        /// <returns>Adjustment rows.</returns>
        [HttpGet("variant/{id}/history")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetHistory(int id, [FromQuery] string? stockKey = null, [FromQuery] int take = 50)
        {
            try
            {
                var territoryId = Scope.TerritoryId;
                if (territoryId == null)
                    return BadRequest(new { error = PickTerritory });

                var key = stockKey ?? "";
                var rows = await DB.InventoryAdjustments
                    .AsNoTracking()
                    .Include(a => a.Order)
                    .Where(a => a.ProductVariantId == id && a.TerritoryId == territoryId && a.StockKey == key)
                    .OrderByDescending(a => a.CreatedAt)
                    .ThenByDescending(a => a.Id)
                    .Take(Math.Clamp(take, 1, 200))
                    .ToListAsync();

                return Ok(rows.Select(a => new InventoryAdjustmentDto
                {
                    Id = a.Id,
                    ProductVariantId = a.ProductVariantId,
                    StockKey = a.StockKey,
                    Kind = a.Kind.ToString(),
                    Change = a.Change,
                    QuantityAfter = a.QuantityAfter,
                    OrderNumber = a.Order?.OrderNumber,
                    UserName = a.UserName,
                    Note = a.Note,
                    CreatedAt = a.CreatedAt,
                }).ToList());
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting inventory history.", e);
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Whether the signed-in crew member may change counts: checkout, sales and checkout,
        /// managers and administrators. Floor-only reps can see stock but not change it.
        /// </summary>
        /// <returns>True when allowed.</returns>
        private bool CanUpdateInventory()
        {
            return IsAtLeast(UserRole.Manager) || IsInRole(UserRole.Checkout) || IsInRole(UserRole.SalesCheckout);
        }

        /// <summary>A product a territory sells: global, or its own.</summary>
        private static bool InTerritoryCatalog(Product product, int territoryId) =>
            product.TerritoryId == null || product.TerritoryId == territoryId;

        /// <summary>
        /// Loads one inventory row.
        /// </summary>
        /// <param name="territoryId">The territory</param>
        /// <param name="variantId">Variant id</param>
        /// <param name="stockKey">Which combination of counted choices</param>
        /// <returns>The row, or null.</returns>
        private async Task<InventoryItemDto?> LoadItemAsync(int territoryId, int variantId, string stockKey)
        {
            return (await LoadItemsAsync(DB, territoryId, null, variantId)).FirstOrDefault(i => (i.StockKey ?? "") == stockKey);
        }

        /// <summary>
        /// Builds a territory's inventory rows for every active tracked size it sells (global and
        /// its own), or for a single size.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="territoryId">The territory whose stock to show</param>
        /// <param name="eventId">Optional event for the sold-at-event totals</param>
        /// <param name="variantId">Optional single variant</param>
        /// <returns>Inventory rows in catalog order.</returns>
        internal static async Task<List<InventoryItemDto>> LoadItemsAsync(ApplicationDbContext db, int territoryId, int? eventId, int? variantId)
        {
            var query = db.ProductVariants
                .AsNoTracking()
                .Include(v => v.Product)
                .ThenInclude(p => p!.Options)
                .ThenInclude(o => o.Choices)
                .AsSplitQuery()
                .Where(v => v.Product!.TrackInventory
                            && (v.Product.TerritoryId == null || v.Product.TerritoryId == territoryId));

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
                         .OrderBy(v => v.Product!.Category)
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
                        Category = v.Product.Category.ToString(),
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
