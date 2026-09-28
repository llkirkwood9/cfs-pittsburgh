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
    /// Fundraiser events. Tax rate, card fee and the order number sequence all live here, which
    /// is what makes those figures customizable per sale.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class EventController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region POST Methods

        /// <summary>
        /// Adds an event and makes it the active one.
        /// </summary>
        /// <param name="request">Event fields</param>
        /// <returns>The created event.</returns>
        [HttpPost("event")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddEvent([FromBody] EventDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Organization) || request.EventDate == null)
                    return BadRequest(new { error = "Missing parameter." });

                if (request.Organization.Length > 150)
                    return BadRequest(new { error = "Invalid parameter." });

                if (request.SalesTaxRate is < 0 or > 1)
                    return BadRequest(new { error = "The sales tax rate must be between 0 and 1." });

                if (request.CcProcessingFeeRate is < 0 or > 1)
                    return BadRequest(new { error = "The card processing fee rate must be between 0 and 1." });

                var newEvent = new Event
                {
                    Organization = request.Organization.Trim(),
                    EventDate = request.EventDate.Value.Date,
                    CartName = request.CartName,
                    SalesTaxRate = request.SalesTaxRate ?? 0.07m,
                    CcProcessingFeeRate = request.CcProcessingFeeRate ?? 0m,
                    NextOrderNumber = request.NextOrderNumber ?? 1001,
                    IsActive = request.IsActive ?? true,
                };

                if (newEvent.IsActive)
                    await DB.Events.ExecuteUpdateAsync(e => e.SetProperty(x => x.IsActive, false));

                DB.Events.Add(newEvent);
                await DB.SaveChangesAsync();

                return Ok(ToDto(newEvent));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while adding the event.", exception = e.Message });
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists every event, most recent first.
        /// </summary>
        /// <returns>All events.</returns>
        [HttpGet("events")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetEvents()
        {
            try
            {
                var events = await DB.Events
                    .OrderByDescending(e => e.EventDate)
                    .ThenByDescending(e => e.Id)
                    .ToListAsync();

                return Ok(events.Select(ToDto).ToList());
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting events.", exception = e.Message });
            }
        }

        /// <summary>
        /// Gets the event the floor app should default to.
        /// </summary>
        /// <returns>
        /// The active event, or 204 No Content when none is active. There is deliberately no
        /// fallback to the most recent event: with no active event, no new orders can be taken.
        /// </returns>
        [HttpGet("event/active")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetActiveEvent()
        {
            try
            {
                var active = await DB.Events.FirstOrDefaultAsync(e => e.IsActive);

                // Not an error: "no event running right now" is a normal state between fundraisers.
                if (active == null)
                    return NoContent();

                return Ok(ToDto(active));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting the active event.", exception = e.Message });
            }
        }

        /// <summary>
        /// Gets a single event.
        /// </summary>
        /// <param name="id">Event id</param>
        /// <returns>The event.</returns>
        [HttpGet("event/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetEvent(int id)
        {
            try
            {
                var found = await DB.Events.FindAsync(id);
                if (found == null)
                    return NotFound(new { error = "Event not found." });

                return Ok(ToDto(found));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting the event.", exception = e.Message });
            }
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Updates an event. Changing the tax rate only affects orders taken from that point on,
        /// because each order stores the rate it was written under.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated event.</returns>
        [HttpPatch("event")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateEvent([FromBody] EventDto request)
        {
            try
            {
                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var found = await DB.Events.FindAsync(request.Id.Value);
                if (found == null)
                    return NotFound(new { error = "Event not found." });

                if (request.Organization != null)
                {
                    if (string.IsNullOrWhiteSpace(request.Organization) || request.Organization.Length > 150)
                        return BadRequest(new { error = "Invalid parameter." });

                    found.Organization = request.Organization.Trim();
                }

                if (request.SalesTaxRate is < 0 or > 1)
                    return BadRequest(new { error = "The sales tax rate must be between 0 and 1." });

                if (request.CcProcessingFeeRate is < 0 or > 1)
                    return BadRequest(new { error = "The card processing fee rate must be between 0 and 1." });

                if (request.CartName != null)
                    found.CartName = request.CartName;

                if (request.EventDate != null)
                    found.EventDate = request.EventDate.Value.Date;

                if (request.SalesTaxRate != null)
                    found.SalesTaxRate = request.SalesTaxRate.Value;

                if (request.CcProcessingFeeRate != null)
                    found.CcProcessingFeeRate = request.CcProcessingFeeRate.Value;

                if (request.NextOrderNumber != null)
                    found.NextOrderNumber = request.NextOrderNumber.Value;

                if (request.IsActive == true && !found.IsActive)
                {
                    await DB.Events.ExecuteUpdateAsync(e => e.SetProperty(x => x.IsActive, false));
                    found.IsActive = true;
                }
                else if (request.IsActive == false)
                {
                    found.IsActive = false;
                }

                await DB.SaveChangesAsync();

                return Ok(ToDto(found));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while updating the event.", exception = e.Message });
            }
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Deletes an event that has no orders against it. An owner can pass permanent=true to delete
        /// an event together with every order taken at it.
        /// </summary>
        /// <param name="id">Event id</param>
        /// <param name="permanent">True to delete the event's orders too (owner only)</param>
        /// <returns>200 when the event was removed.</returns>
        [HttpDelete("event/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteEvent(int id, [FromQuery] bool permanent = false)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = "Only an administrator may delete an event." });

                if (permanent && !IsOwner())
                    return StatusCode(403, new { error = "Only an owner can delete an event with its orders." });

                var found = await DB.Events.FindAsync(id);
                if (found == null)
                    return NotFound(new { error = "Event not found." });

                if (permanent)
                {
                    await PermanentDelete.EventAsync(DB, id);
                    return Ok();
                }

                if (await DB.Orders.AnyAsync(o => o.EventId == id))
                    return BadRequest(new { error = "This event has orders against it and cannot be deleted." });

                DB.Events.Remove(found);
                await DB.SaveChangesAsync();

                return Ok();
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while deleting the event.", exception = e.Message });
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Maps an event entity to its DTO.
        /// </summary>
        /// <param name="entity">Event entity</param>
        /// <returns>The mapped DTO.</returns>
        private static EventDto ToDto(Event entity)
        {
            return new EventDto
            {
                Id = entity.Id,
                Organization = entity.Organization,
                EventDate = entity.EventDate,
                CartName = entity.CartName,
                InventoryNotes = entity.InventoryNotes,
                SalesTaxRate = entity.SalesTaxRate,
                CcProcessingFeeRate = entity.CcProcessingFeeRate,
                NextOrderNumber = entity.NextOrderNumber,
                IsActive = entity.IsActive,
                CreatedAt = entity.CreatedAt,
            };
        }

        #endregion
    }
}
