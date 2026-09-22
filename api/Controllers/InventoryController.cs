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

                var change = request.SetTo != null
                    ? request.SetTo.Value - variant.QuantityOnHand
                    : request.Change!.Value;

                if (variant.QuantityOnHand + change < 0)
                    return BadRequest(new { error = "The count cannot go below zero." });

                if (change == 0)
                    return Ok(await LoadItemAsync(variant.Id));

                variant.QuantityOnHand += change;

                DB.InventoryAdjustments.Add(new InventoryAdjustment
                {
                    ProductVariantId = variant.Id,
                    Kind = InventoryChangeKind.Adjustment,
                    Change = change,
                    QuantityAfter = variant.QuantityOnHand,
                    UserId = GetCurrentUserId(),
                    UserName = GetCurrentUserName(),
                    Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
                });

                await DB.SaveChangesAsync();

                return Ok(await LoadItemAsync(variant.Id));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while updating inventory.", exception = e.Message });
            }
        }

        /// <summary>
        /// Saves the end-of-event shelf count. Each counted size is set to what was found, and a
        /// Count row is recorded for it - even when it matched - so the event's inventory sheet
        /// shows what was expected and what was on the shelf.
        /// </summary>
        /// <param name="request">Event id, optional note and the counted sizes</param>
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

                // The last entry for a size wins if it was sent twice.
                var counts = request.Counts
                    .GroupBy(c => c.ProductVariantId!.Value)
                    .ToDictionary(g => g.Key, g => g.Last().Counted!.Value);

                var ids = counts.Keys.ToList();
                var variants = await DB.ProductVariants
                    .Include(v => v.Product)
                    .Where(v => ids.Contains(v.Id))
                    .ToListAsync();

                if (variants.Count != ids.Count || variants.Any(v => v.Product is not { TrackInventory: true }))
                    return BadRequest(new { error = "Only tracked products can be counted." });

                var note = string.IsNullOrWhiteSpace(request.Note) ? "End-of-event count" : request.Note.Trim();
                var now = DateTime.UtcNow;

                foreach (var variant in variants)
                {
                    var counted = counts[variant.Id];
                    var change = counted - variant.QuantityOnHand;
                    variant.QuantityOnHand = counted;

                    DB.InventoryAdjustments.Add(new InventoryAdjustment
                    {
                        ProductVariantId = variant.Id,
                        Kind = InventoryChangeKind.Count,
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

                return Ok(await LoadItemsAsync(request.EventId, null));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while saving the count.", exception = e.Message });
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
                return Ok(await LoadItemsAsync(eventId, null));
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
        /// <param name="take">How many rows to return, at most 200</param>
        /// <returns>Adjustment rows.</returns>
        [HttpGet("variant/{id}/history")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetHistory(int id, [FromQuery] int take = 50)
        {
            try
            {
                var rows = await DB.InventoryAdjustments
                    .AsNoTracking()
                    .Include(a => a.Order)
                    .Where(a => a.ProductVariantId == id)
                    .OrderByDescending(a => a.CreatedAt)
                    .ThenByDescending(a => a.Id)
                    .Take(Math.Clamp(take, 1, 200))
                    .ToListAsync();

                return Ok(rows.Select(a => new InventoryAdjustmentDto
                {
                    Id = a.Id,
                    ProductVariantId = a.ProductVariantId,
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
        /// <returns>The row, or null.</returns>
        private async Task<InventoryItemDto?> LoadItemAsync(int variantId)
        {
            return (await LoadItemsAsync(null, variantId)).FirstOrDefault();
        }

        /// <summary>
        /// Builds the inventory rows for every active tracked size, or for a single size.
        /// </summary>
        /// <param name="eventId">Optional event for the sold-at-event totals</param>
        /// <param name="variantId">Optional single variant</param>
        /// <returns>Inventory rows in catalog order.</returns>
        private async Task<List<InventoryItemDto>> LoadItemsAsync(int? eventId, int? variantId)
        {
            var query = DB.ProductVariants
                .AsNoTracking()
                .Include(v => v.Product)
                .Where(v => v.Product!.TrackInventory);

            query = variantId != null
                ? query.Where(v => v.Id == variantId.Value)
                : query.Where(v => v.IsActive && v.Product!.IsActive);

            var variants = await query.ToListAsync();
            var ids = variants.Select(v => v.Id).ToList();

            var lastChanged = await DB.InventoryAdjustments
                .Where(a => ids.Contains(a.ProductVariantId))
                .GroupBy(a => a.ProductVariantId)
                .Select(g => new { VariantId = g.Key, At = g.Max(a => a.CreatedAt) })
                .ToDictionaryAsync(x => x.VariantId, x => x.At);

            var sold = eventId == null
                ? new Dictionary<int, int>()
                : await DB.InventoryAdjustments
                    .Where(a => a.EventId == eventId
                                && ids.Contains(a.ProductVariantId)
                                && (a.Kind == InventoryChangeKind.Sale || a.Kind == InventoryChangeKind.Return))
                    .GroupBy(a => a.ProductVariantId)
                    .Select(g => new { VariantId = g.Key, Net = g.Sum(a => a.Change) })
                    .ToDictionaryAsync(x => x.VariantId, x => -x.Net);

            // The latest shelf count taken at the event, per size.
            var eventCounts = eventId == null
                ? []
                : (await DB.InventoryAdjustments
                    .Where(a => a.EventId == eventId
                                && ids.Contains(a.ProductVariantId)
                                && a.Kind == InventoryChangeKind.Count)
                    .ToListAsync())
                    .GroupBy(a => a.ProductVariantId)
                    .Select(g => g.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id).First())
                    .ToList();

            return variants
                .OrderBy(v => v.Product!.Category)
                .ThenBy(v => v.Product!.SortOrder)
                .ThenBy(v => v.Product!.Name)
                .ThenBy(v => v.SortOrder)
                .Select(v => new InventoryItemDto
                {
                    ProductVariantId = v.Id,
                    ProductId = v.ProductId,
                    ProductName = v.Product!.Name,
                    Brand = v.Product.Brand,
                    Category = v.Product.Category.ToString(),
                    Size = v.Size,
                    Configuration = v.Configuration,
                    QuantityOnHand = v.QuantityOnHand,
                    SoldAtEvent = eventId == null ? null : sold.GetValueOrDefault(v.Id),
                    CountedAtEvent = eventCounts.FirstOrDefault(c => c.ProductVariantId == v.Id)?.QuantityAfter,
                    ExpectedAtCount = eventCounts.FirstOrDefault(c => c.ProductVariantId == v.Id) is { } count
                        ? count.QuantityAfter - count.Change
                        : null,
                    LastChangedAt = lastChanged.TryGetValue(v.Id, out var at) ? at : null,
                })
                .ToList();
        }

        #endregion
    }
}
