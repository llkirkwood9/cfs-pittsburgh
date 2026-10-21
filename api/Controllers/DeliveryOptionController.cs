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
    /// The catalog of delivery methods and in-home services. Products opt into these
    /// individually, so what is offered on a Purple need not match what is offered on a Langley.
    /// Like products, an option is either global (every territory) or one territory's own; a
    /// manager changes only their territory's.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class DeliveryOptionController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region Private Fields

        private const string NotYourCatalog = "You can only change the catalog of your own territories.";

        #endregion

        #region POST Methods

        /// <summary>
        /// Adds a delivery option - to the manager's territory, or for a system admin or administrator
        /// either globally or to a territory they pick.
        /// </summary>
        /// <param name="request">Delivery option fields</param>
        /// <returns>The created option.</returns>
        [HttpPost("deliveryoption")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddDeliveryOption([FromBody] DeliveryOptionDto request)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden("Only a manager, administrator or system admin may change the catalog.");

                if (string.IsNullOrWhiteSpace(request.Name))
                    return BadRequest(new { error = "Enter a name." });

                if (request.Name.Trim().Length > 100)
                    return BadRequest(new { error = "Invalid parameter." });

                if (request.Price is < 0 or > 100_000)
                    return BadRequest(new { error = "The price must be between $0 and $100,000." });

                var (territoryId, problem) = await CatalogTerritoryAsync(request.TerritoryId);
                if (problem != null)
                    return problem;

                if (await NameClashesAsync(request.Name, territoryId, null))
                    return BadRequest(new { error = "A delivery option with that name already exists." });

                var saleProblem = SaleProblem(request);
                if (saleProblem != null)
                    return BadRequest(new { error = saleProblem });

                var option = new DeliveryOption
                {
                    Name = request.Name.Trim(),
                    TerritoryId = territoryId,
                    Price = request.Price ?? 0m,
                    IsTaxable = request.IsTaxable ?? true,
                    IsTakeWith = request.IsTakeWith ?? false,
                    // Take With defaults to hidden: the item's own Take With column already says it.
                    ShowOnSalesSheet = request.ShowOnSalesSheet ?? !(request.IsTakeWith ?? false),
                    // A new option goes to the end of its list - global, or its territory's own -
                    // unless a place is given.
                    SortOrder = request.SortOrder
                                ?? (await DB.DeliveryOptions.Where(d => d.TerritoryId == territoryId).MaxAsync(d => (int?)d.SortOrder) ?? 0) + 1,
                    IsActive = request.IsActive ?? true,
                };
                (option.SaleDiscountPercent, option.SaleDiscountAmount) =
                    ProductController.CleanSale(request.SaleDiscountPercent, request.SaleDiscountAmount);

                DB.DeliveryOptions.Add(option);
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(option.Id));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while adding the delivery option.", e);
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists the delivery options of the territory being worked - or of all the user's
        /// territories, each naming its own, when none is picked.
        /// </summary>
        /// <param name="includeInactive">Pass true from the admin screen</param>
        /// <returns>Delivery options in display order.</returns>
        [HttpGet("deliveryoptions")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetDeliveryOptions([FromQuery] bool includeInactive = false)
        {
            try
            {
                return Ok(await ListAsync(includeInactive));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting delivery options.", e);
            }
        }

        #endregion

        #region PUT Methods

        /// <summary>
        /// Puts one territory's delivery options in a new order, the order the sales floor offers
        /// them in.
        /// </summary>
        /// <param name="ids">Every option id in that list, archived ones included, in the new order</param>
        /// <returns>The options in view, in their new order.</returns>
        [HttpPut("deliveryoptions/order")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> ReorderDeliveryOptions([FromBody] List<int> ids)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden("Only a manager, administrator or system admin may change the catalog.");

                if (ids.Count == 0 || ids.Distinct().Count() != ids.Count)
                    return BadRequest(new { error = "Invalid parameter." });

                var first = await DB.DeliveryOptions.FindAsync(ids[0]);
                if (first == null)
                    return BadRequest(new { error = "The list has changed. Refresh and try again." });

                var group = await DB.DeliveryOptions.Where(d => d.TerritoryId == first.TerritoryId).ToListAsync();
                if (group.Count != ids.Count || group.Any(o => !ids.Contains(o.Id)))
                    return BadRequest(new { error = "The list has changed. Refresh and try again." });

                if (!CanEditCatalog(first.TerritoryId))
                    return Forbidden(NotYourCatalog);

                foreach (var option in group)
                    option.SortOrder = ids.IndexOf(option.Id) + 1;

                await DB.SaveChangesAsync();

                return Ok(await ListAsync(includeInactive: true));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while reordering the delivery options.", e);
            }
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Updates a delivery option. It stays in its territory's catalog.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated option.</returns>
        [HttpPatch("deliveryoption")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateDeliveryOption([FromBody] DeliveryOptionDto request)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden("Only a manager, administrator or system admin may change the catalog.");

                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var option = await DB.DeliveryOptions.FindAsync(request.Id.Value);
                if (option == null || !Scope.CanSee(option.TerritoryId))
                    return NotFound(new { error = "Delivery option not found." });

                if (!CanEditCatalog(option.TerritoryId))
                    return Forbidden(NotYourCatalog);

                if (request.Name != null)
                {
                    if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 100)
                        return BadRequest(new { error = "Invalid parameter." });

                    if (await NameClashesAsync(request.Name, option.TerritoryId, option.Id))
                        return BadRequest(new { error = "A delivery option with that name already exists." });

                    option.Name = request.Name.Trim();
                }

                if (request.Price is < 0 or > 100_000)
                    return BadRequest(new { error = "The price must be between $0 and $100,000." });

                if (request.Price != null)
                    option.Price = request.Price.Value;

                if (request.IsTaxable != null)
                    option.IsTaxable = request.IsTaxable.Value;

                if (request.IsTakeWith != null)
                    option.IsTakeWith = request.IsTakeWith.Value;

                if (request.ShowOnSalesSheet != null)
                    option.ShowOnSalesSheet = request.ShowOnSalesSheet.Value;

                if (request.SortOrder != null)
                    option.SortOrder = request.SortOrder.Value;

                if (request.IsActive != null)
                    option.IsActive = request.IsActive.Value;

                // The editor always sends the whole sale; 0 or nothing clears it.
                var saleProblem = SaleProblem(request);
                if (saleProblem != null)
                    return BadRequest(new { error = saleProblem });

                if (request.SaleDiscountPercent != null || request.SaleDiscountAmount != null)
                    (option.SaleDiscountPercent, option.SaleDiscountAmount) =
                        ProductController.CleanSale(request.SaleDiscountPercent, request.SaleDiscountAmount);

                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(option.Id));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while updating the delivery option.", e);
            }
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Removes a delivery option, or deactivates it when it already appears on an order. A system admin
        /// can delete one that has been used; past sales keep the shipping row as printed.
        /// </summary>
        /// <param name="id">Delivery option id</param>
        /// <param name="permanent">True to delete even a used option (system admin only)</param>
        /// <returns>200, with a flag saying whether the row was archived instead of deleted.</returns>
        [HttpDelete("deliveryoption/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteDeliveryOption(int id, [FromQuery] bool permanent = false)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden("Only a manager, administrator or system admin may change the catalog.");

                var option = await DB.DeliveryOptions.FindAsync(id);
                if (option == null || !Scope.CanSee(option.TerritoryId))
                    return NotFound(new { error = "Delivery option not found." });

                if (!CanEditCatalog(option.TerritoryId))
                    return Forbidden(NotYourCatalog);

                if (permanent)
                {
                    if (!IsSystemAdmin())
                        return Forbidden("Only a system admin can delete a delivery option permanently.");

                    await PermanentDelete.DeliveryOptionAsync(DB, id);
                    return Ok(new { archived = false });
                }

                if (await DB.OrderLines.AnyAsync(l => l.DeliveryOptionId == id))
                {
                    option.IsActive = false;
                    await DB.SaveChangesAsync();
                    return Ok(new { archived = true });
                }

                DB.DeliveryOptions.Remove(option);
                await DB.SaveChangesAsync();

                return Ok(new { archived = false });
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while deleting the delivery option.", e);
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// The delivery options in view: the territory being worked's, or all the user's
        /// territories', each territory's in its order.
        /// </summary>
        /// <param name="includeInactive">Whether archived options are included</param>
        /// <returns>The options as DTOs.</returns>
        private async Task<List<DeliveryOptionDto>> ListAsync(bool includeInactive)
        {
            var visible = Scope.VisibleTerritoryIds;
            var query = DB.DeliveryOptions.Include(d => d.Territory).AsNoTracking()
                .Where(d => d.TerritoryId != null && (visible == null || visible.Contains(d.TerritoryId.Value)));

            if (!includeInactive)
                query = query.Where(d => d.IsActive);

            var options = await query
                .OrderBy(d => d.Territory!.Name)
                .ThenBy(d => d.SortOrder)
                .ThenBy(d => d.Name)
                .ToListAsync();

            return options.Select(ToDto).ToList();
        }

        /// <summary>
        /// Whether a name is already used by another option in the same territory's catalog.
        /// </summary>
        private async Task<bool> NameClashesAsync(string name, int? territoryId, int? exceptId)
        {
            var lower = name.Trim().ToLower();
            return await DB.DeliveryOptions.AnyAsync(d => d.Name.ToLower() == lower
                                                          && d.Id != exceptId
                                                          && d.TerritoryId == territoryId);
        }

        private async Task<DeliveryOptionDto?> LoadDtoAsync(int id)
        {
            var option = await DB.DeliveryOptions.Include(d => d.Territory).AsNoTracking().FirstOrDefaultAsync(d => d.Id == id);
            return option == null ? null : ToDto(option);
        }

        /// <summary>
        /// Maps a delivery option entity to its DTO.
        /// </summary>
        /// <param name="option">Delivery option entity, with Territory loaded</param>
        /// <returns>The mapped DTO.</returns>
        private DeliveryOptionDto ToDto(DeliveryOption option)
        {
            return new DeliveryOptionDto
            {
                Id = option.Id,
                TerritoryId = option.TerritoryId,
                TerritoryName = option.Territory?.Name,
                CanEdit = CanEditCatalog(option.TerritoryId),
                Name = option.Name,
                Price = option.Price,
                IsTaxable = option.IsTaxable,
                IsTakeWith = option.IsTakeWith,
                ShowOnSalesSheet = option.ShowOnSalesSheet,
                SortOrder = option.SortOrder,
                IsActive = option.IsActive,
                SaleDiscountPercent = option.SaleDiscountPercent,
                SaleDiscountAmount = option.SaleDiscountAmount,
            };
        }

        /// <summary>
        /// Why a delivery option's sale can't be saved, or null when it's fine.
        /// </summary>
        private static string? SaleProblem(DeliveryOptionDto request)
        {
            if (request.SaleDiscountPercent is < 0 or > 100)
                return "A sale percent must be between 0 and 100.";
            if (request.SaleDiscountAmount < 0)
                return "A sale amount can't be negative.";
            return null;
        }

        #endregion
    }
}
