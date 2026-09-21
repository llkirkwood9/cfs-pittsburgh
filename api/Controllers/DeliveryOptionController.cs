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
        #region POST Methods

        /// <summary>
        /// Adds a delivery option.
        /// </summary>
        /// <param name="request">Delivery option fields</param>
        /// <returns>The created option.</returns>
        [HttpPost("deliveryoption")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddDeliveryOption([FromBody] DeliveryOptionDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                    return BadRequest(new { error = "Missing parameter." });

                if (await DB.DeliveryOptions.AnyAsync(d => d.Name == request.Name))
                    return BadRequest(new { error = "A delivery option with that name already exists." });

                if (request.Name.Length > 100)
                    return BadRequest(new { error = "Invalid parameter." });

                if (request.Price is < 0)
                    return BadRequest(new { error = "The price cannot be negative." });

                var option = new DeliveryOption
                {
                    Name = request.Name,
                    Price = request.Price ?? 0m,
                    IsTaxable = request.IsTaxable ?? true,
                    IsTakeWith = request.IsTakeWith ?? false,
                    SortOrder = request.SortOrder ?? 0,
                    IsActive = request.IsActive ?? true,
                };

                DB.DeliveryOptions.Add(option);
                await DB.SaveChangesAsync();

                return Ok(ToDto(option));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while adding the delivery option.", exception = e.Message });
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists the delivery options.
        /// </summary>
        /// <param name="includeInactive">Pass true from the admin screen</param>
        /// <returns>Delivery options in display order.</returns>
        [HttpGet("deliveryoptions")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetDeliveryOptions([FromQuery] bool includeInactive = false)
        {
            try
            {
                var query = DB.DeliveryOptions.AsNoTracking().AsQueryable();

                if (!includeInactive)
                    query = query.Where(d => d.IsActive);

                var options = await query
                    .OrderBy(d => d.SortOrder)
                    .ThenBy(d => d.Name)
                    .ToListAsync();

                return Ok(options.Select(ToDto).ToList());
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting delivery options.", exception = e.Message });
            }
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Updates a delivery option.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated option.</returns>
        [HttpPatch("deliveryoption")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateDeliveryOption([FromBody] DeliveryOptionDto request)
        {
            try
            {
                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var option = await DB.DeliveryOptions.FindAsync(request.Id.Value);
                if (option == null)
                    return NotFound(new { error = "Delivery option not found." });

                if (request.Name != null)
                {
                    if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 100)
                        return BadRequest(new { error = "Invalid parameter." });

                    if (await DB.DeliveryOptions.AnyAsync(d => d.Name == request.Name && d.Id != option.Id))
                        return BadRequest(new { error = "A delivery option with that name already exists." });

                    option.Name = request.Name;
                }

                if (request.Price is < 0)
                    return BadRequest(new { error = "The price cannot be negative." });

                if (request.Price != null)
                    option.Price = request.Price.Value;

                if (request.IsTaxable != null)
                    option.IsTaxable = request.IsTaxable.Value;

                if (request.IsTakeWith != null)
                    option.IsTakeWith = request.IsTakeWith.Value;

                if (request.SortOrder != null)
                    option.SortOrder = request.SortOrder.Value;

                if (request.IsActive != null)
                    option.IsActive = request.IsActive.Value;

                await DB.SaveChangesAsync();

                return Ok(ToDto(option));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while updating the delivery option.", exception = e.Message });
            }
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Removes a delivery option, or deactivates it when it already appears on an order.
        /// </summary>
        /// <param name="id">Delivery option id</param>
        /// <returns>200, with a flag saying whether the row was archived instead of deleted.</returns>
        [HttpDelete("deliveryoption/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteDeliveryOption(int id)
        {
            try
            {
                var option = await DB.DeliveryOptions.FindAsync(id);
                if (option == null)
                    return NotFound(new { error = "Delivery option not found." });

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
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while deleting the delivery option.", exception = e.Message });
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Maps a delivery option entity to its DTO.
        /// </summary>
        /// <param name="option">Delivery option entity</param>
        /// <returns>The mapped DTO.</returns>
        private static DeliveryOptionDto ToDto(DeliveryOption option)
        {
            return new DeliveryOptionDto
            {
                Id = option.Id,
                Name = option.Name,
                Price = option.Price,
                IsTaxable = option.IsTaxable,
                IsTakeWith = option.IsTakeWith,
                SortOrder = option.SortOrder,
                IsActive = option.IsActive,
            };
        }

        #endregion
    }
}
