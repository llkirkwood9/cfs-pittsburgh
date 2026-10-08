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
    /// On-hand stock for the accessories kept at the cart. Only products marked Track inventory
    /// appear here. Counts are changed by the checkout team and administrators; Take With sales
    /// draw them down automatically when an order is completed.
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
        #region POST Methods

        /// <summary>
        /// Changes the on-hand count of one tracked size, either by an amount or to a counted total.
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
                    return StatusCode(403, new { error = "Only checkout and administrators may change inventory." });

                if (request.ProductVariantId == null || (request.Change == null) == (request.SetTo == null))
                    return BadRequest(new { error = "Missing parameter." });

                if (request.Note is { Length: > 300 })
                    return BadRequest(new { error = "Invalid parameter." });

                var variant = await DB.ProductVariants
                    .Include(v => v.Product)
                    .FirstOrDefaultAsync(v => v.Id == request.ProductVariantId.Value);

                if (variant?.Product == null)
                    return NotFound(new { error = "Product not found." });

                if (!variant.Product.TrackInventory)
                    return BadRequest(new { error = "This product does not track inventory." });

                if (variant.ExcludeFromInventory)
                    return BadRequest(new { error = "This size is left out of inventory." });

                var key = request.StockKey ?? "";
                var onHand = await Choices.OnHandAsync(DB, variant, key);
                var change = request.SetTo != null
                    ? request.SetTo.Value - onHand
                    : request.Change!.Value;

                if (onHand + change < 0)
                    return BadRequest(new { error = "The count cannot go below zero." });

                if (change == 0)
                    return Ok(await LoadItemAsync(variant.Id, key));

                var after = await Choices.ChangeAsync(DB, variant, key, change);

                DB.InventoryAdjustments.Add(new InventoryAdjustment
                {
                    ProductVariantId = variant.Id,
                    StockKey = key,
                    Kind = InventoryChangeKind.Adjustment,
                    Change = change,
                    QuantityAfter = after,
                    UserId = GetCurrentUserId(),
                    UserName = GetCurrentUserName(),
                    Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
                });

                await DB.SaveChangesAsync();

                return Ok(await LoadItemAsync(variant.Id, key));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while updating inventory.", exception = e.Message });
            }
        }

        /// <summary>
        /// Saves a shelf count for an event - the start-of-event count before the doors open, or
        /// the end-of-event count once they close. Each counted size is set to what was found, and
        /// a row is recorded for it - even when it matched - so the event's inventory sheet shows
        /// what the event started with, what was expected at the end and what was on the shelf.
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
                    return StatusCode(403, new { error = "Only checkout and administrators may change inventory." });

                if (request.EventId == null || request.Counts == null || request.Counts.Count == 0)
                    return BadRequest(new { error = "Missing parameter." });

                if (request.Note is { Length: > 300 })
                    return BadRequest(new { error = "Invalid parameter." });

                if (request.Counts.Any(c => c.ProductVariantId == null || c.Counted is null or < 0))
                    return BadRequest(new { error = "Every count must be a whole number, 0 or more." });

                if (!await DB.Events.AnyAsync(e => e.Id == request.EventId.Value))
                    return NotFound(new { error = "Event not found." });

                // The last entry for a size (and combination of choices) wins if it was sent twice.
                var counts = request.Counts
                    .GroupBy(c => (c.ProductVariantId!.Value, c.StockKey ?? ""))
                    .ToDictionary(g => g.Key, g => g.Last().Counted!.Value);

                var ids = counts.Keys.Select(k => k.Item1).Distinct().ToList();
                var variants = await DB.ProductVariants
                    .Include(v => v.Product)
                    .Where(v => ids.Contains(v.Id))
                    .ToListAsync();

                if (variants.Count != ids.Count || variants.Any(v => v.Product is not { TrackInventory: true } || v.ExcludeFromInventory))
                    return BadRequest(new { error = "Only tracked products can be counted." });

                var opening = string.Equals(request.Phase, "Start", StringComparison.OrdinalIgnoreCase);
                var kind = opening ? InventoryChangeKind.OpeningCount : InventoryChangeKind.Count;
                var note = string.IsNullOrWhiteSpace(request.Note)
                    ? opening ? "Start-of-event count" : "End-of-event count"
                    : request.Note.Trim();
                var now = DateTime.UtcNow;

                foreach (var ((variantId, key), counted) in counts)
                {
                    var variant = variants.First(v => v.Id == variantId);
                    var change = counted - await Choices.OnHandAsync(DB, variant, key);
                    await Choices.ChangeAsync(DB, variant, key, change);

                    DB.InventoryAdjustments.Add(new InventoryAdjustment
                    {
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

                return Ok(await LoadItemsAsync(DB, request.EventId, null));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while saving the count.", exception = e.Message });
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
                    return StatusCode(403, new { error = "Only checkout and administrators may change inventory." });

                if (request.Notes is { Length: > 2000 })
                    return BadRequest(new { error = "The notes can be at most 2,000 characters." });

                var saleEvent = await DB.Events.FindAsync(eventId);
                if (saleEvent == null)
                    return NotFound(new { error = "Event not found." });

                saleEvent.InventoryNotes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
                await DB.SaveChangesAsync();

                return Ok(new InventoryNotesDto { EventId = saleEvent.Id, Notes = saleEvent.InventoryNotes });
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while saving the notes.", exception = e.Message });
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists every tracked size with its on-hand count.
        /// </summary>
        /// <param name="eventId">Optional event, to include what its Take With sales used</param>
        /// <returns>Inventory rows in catalog order.</returns>
        [HttpGet("items")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetInventory([FromQuery] int? eventId = null)
        {
            try
            {
                return Ok(await LoadItemsAsync(DB, eventId, null));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting inventory.", exception = e.Message });
            }
        }

        /// <summary>
        /// Recent changes to one size's count, newest first.
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
                var key = stockKey ?? "";
                var rows = await DB.InventoryAdjustments
                    .AsNoTracking()
                    .Include(a => a.Order)
                    .Where(a => a.ProductVariantId == id && a.StockKey == key)
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
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting inventory history.", exception = e.Message });
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Whether the signed-in crew member may change counts: checkout, sales and checkout, and
        /// administrators. Floor-only reps can see stock but not change it.
        /// </summary>
        /// <returns>True when allowed.</returns>
        private bool CanUpdateInventory()
        {
            return IsInRole(UserRole.Admin) || IsInRole(UserRole.Checkout) || IsInRole(UserRole.SalesCheckout);
        }

        /// <summary>
        /// Loads one inventory row.
        /// </summary>
        /// <param name="variantId">Variant id</param>
        /// <param name="stockKey">Which combination of counted choices</param>
        /// <returns>The row, or null.</returns>
        private async Task<InventoryItemDto?> LoadItemAsync(int variantId, string stockKey)
        {
            return (await LoadItemsAsync(DB, null, variantId)).FirstOrDefault(i => (i.StockKey ?? "") == stockKey);
        }

        /// <summary>
        /// Builds the inventory rows for every active tracked size, or for a single size. Sizes left
        /// out of their product's inventory are skipped.
        /// </summary>
        /// <param name="db">EF context</param>
        /// <param name="eventId">Optional event for the sold-at-event totals</param>
        /// <param name="variantId">Optional single variant</param>
        /// <returns>Inventory rows in catalog order.</returns>
        internal static async Task<List<InventoryItemDto>> LoadItemsAsync(ApplicationDbContext db, int? eventId, int? variantId)
        {
            var query = db.ProductVariants
                .AsNoTracking()
                .Include(v => v.Product)
                .ThenInclude(p => p!.Options)
                .ThenInclude(o => o.Choices)
                .Include(v => v.ChoiceStocks)
                .AsSplitQuery()
                .Where(v => v.Product!.TrackInventory && !v.ExcludeFromInventory);

            query = variantId != null
                ? query.Where(v => v.Id == variantId.Value)
                : query.Where(v => v.IsActive && v.Product!.IsActive);

            var variants = await query.ToListAsync();
            var ids = variants.Select(v => v.Id).ToList();

            var lastChanged = await db.InventoryAdjustments
                .Where(a => ids.Contains(a.ProductVariantId))
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
                foreach (var extra in v.ChoiceStocks.Where(cs => cs.QuantityOnHand != 0 && keys.All(k => k.Key != cs.StockKey)))
                    keys.Add((extra.StockKey, Choices.LabelFor(v.Product!, extra.StockKey) + " (no longer offered)"));
                if (keys.All(k => k.Key != "") && v.QuantityOnHand != 0)
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
                        QuantityOnHand = key == "" ? v.QuantityOnHand : v.ChoiceStocks.FirstOrDefault(cs => cs.StockKey == key)?.QuantityOnHand ?? 0,
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
