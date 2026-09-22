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
                    LastChangedAt = lastChanged.TryGetValue(v.Id, out var at) ? at : null,
                })
                .ToList();
        }

        #endregion
    }
}
