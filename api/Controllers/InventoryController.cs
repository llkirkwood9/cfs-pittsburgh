using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using api.Data;
using api.Dtos;
using api.Inventory;
using api.Models;
using api.Services;
using api.Utils;

namespace api.Controllers
{
    /// <summary>
    /// On-hand stock for the accessories kept at the cart, per territory. Only products marked
    /// Track inventory in the territory's catalog appear here. Counts are changed by
    /// the checkout team, managers and administrators; Take With sales draw them down
    /// automatically when an order is completed.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class InventoryController(
        ApplicationDbContext db,
        ILogger<BasicController> logger)
        : BasicController(db, logger)
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

            if (variant?.Product == null || variant.Product.TerritoryId != territoryId.Value)
                return NotFound(new { error = "Product not found." });

            if (!variant.Product.TrackInventory)
                return BadRequest(new { error = "This product does not track inventory." });

            if (variant.ExcludeFromInventory)
                return BadRequest(new { error = "This size is left out of inventory." });

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
            InventoryRules.Record(DB, stock, InventoryChangeKind.Adjustment, change, GetCurrentUserId(), GetCurrentUserName(),
                string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim());

            await DB.SaveChangesAsync();

            return Ok(await LoadItemAsync(territoryId.Value, variant.Id, key));
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
            if (!CanUpdateInventory())
                return Forbidden(CannotUpdate);

            if (request.EventId == null || request.Counts == null || request.Counts.Count == 0)
                return BadRequest(new { error = "Missing parameter." });

            if (request.Note is { Length: > 300 } || request.Counts.Count > 2000)
                return BadRequest(new { error = "Invalid parameter." });

            if (request.Counts.Any(c => c.ProductVariantId == null || c.Counted is null or < 0 or > 100_000))
                return BadRequest(new { error = "Every count must be a whole number, 0 or more." });

            var saleEvent = (await DB.Events.FindAsync(request.EventId.Value)).IfVisibleTo(Scope);
            if (saleEvent == null)
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
                || variants.Any(v => !InventoryRules.IsTracked(v) || v.Product!.TerritoryId != territoryId))
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

                var row = InventoryRules.Record(DB, stock, kind, change, GetCurrentUserId(), GetCurrentUserName(), note,
                    eventId: request.EventId);
                row.CreatedAt = now;
            }

            await DB.SaveChangesAsync();

            return Ok(await InventorySheet.LoadItemsAsync(DB, territoryId, request.EventId, null));
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
            if (!CanUpdateInventory())
                return Forbidden(CannotUpdate);

            if (request.Notes is { Length: > 2000 })
                return BadRequest(new { error = "The notes can be at most 2,000 characters." });

            var saleEvent = (await DB.Events.FindAsync(eventId)).IfVisibleTo(Scope);
            if (saleEvent == null)
                return NotFound(new { error = "Event not found." });

            saleEvent.InventoryNotes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
            await DB.SaveChangesAsync();

            return Ok(new InventoryNotesDto { EventId = saleEvent.Id, Notes = saleEvent.InventoryNotes });
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
            int? territoryId = Scope.TerritoryId;
            if (eventId != null)
            {
                var saleEvent = (await DB.Events.AsNoTracking().FirstOrDefaultAsync(e => e.Id == eventId.Value)).IfVisibleTo(Scope);
                if (saleEvent == null)
                    return NotFound(new { error = "Event not found." });
                territoryId = saleEvent.TerritoryId;
            }

            if (territoryId == null)
                return Ok(new List<InventoryItemDto>());

            return Ok(await InventorySheet.LoadItemsAsync(DB, territoryId.Value, eventId, null));
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

        #endregion

        #region Private Methods

        /// <summary>
        /// Whether the signed-in crew member may change counts: checkout, sales and checkout,
        /// managers and administrators. Floor-only reps can see stock but not change it.
        /// </summary>
        /// <returns>True when allowed.</returns>
        private bool CanUpdateInventory()
        {
            return Scope.CanWorkCheckout;
        }

        /// <summary>
        /// Loads one inventory row.
        /// </summary>
        /// <param name="territoryId">The territory</param>
        /// <param name="variantId">Variant id</param>
        /// <param name="stockKey">Which combination of counted choices</param>
        /// <returns>The row, or null.</returns>
        private async Task<InventoryItemDto?> LoadItemAsync(int territoryId, int variantId, string stockKey)
        {
            return (await InventorySheet.LoadItemsAsync(DB, territoryId, null, variantId)).FirstOrDefault(i => (i.StockKey ?? "") == stockKey);
        }

        #endregion
    }
}
