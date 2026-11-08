using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using api.Data;
using api.Dtos;
using api.Models;
using api.Services;
using api.Settings;
using api.Utils;

namespace api.Controllers
{
    /// <summary>
    /// Fundraiser events. Each belongs to a territory, and each territory has at most one active
    /// event - the one its floor sells under. Tax rate, card fee and the order number sequence all
    /// live here, which is what makes those figures customizable per sale.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class EventController(
        ApplicationDbContext db,
        ILogger<BasicController> logger)
        : BasicController(db, logger)
    {
        #region Private Fields

        private const string ManagersOnly = "Only a manager, administrator or system admin may set up events.";

        #endregion

        #region POST Methods

        /// <summary>
        /// Adds an event to a territory - a manager's own, or the one a system admin or administrator
        /// picks - and, unless told otherwise, makes it that territory's active event.
        /// </summary>
        /// <param name="request">Event fields</param>
        /// <returns>The created event.</returns>
        [HttpPost("event")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddEvent([FromBody] EventDto request)
        {
            if (!IsAtLeast(UserRole.Manager))
                return Forbidden(ManagersOnly);

            if (string.IsNullOrWhiteSpace(request.Organization) || request.EventDate == null)
                return BadRequest(new { error = "Enter the organization and the event date." });

            if (request.Organization.Length > 150 || (request.CartName?.Length ?? 0) > 100)
                return BadRequest(new { error = "Invalid parameter." });

            if (Rates.Problem(request.SalesTaxRate, request.CcProcessingFeeRate) is { } rateProblem)
                return BadRequest(new { error = rateProblem });

            var scope = Scope;
            var territoryId = request.TerritoryId ?? scope.TerritoryId;
            if (territoryId == null)
                return BadRequest(new { error = "Pick the territory this event is in." });

            if (!scope.CanSee(territoryId))
                return Forbidden("You can only add events to your own territories.");

            if (!await DB.Territories.AnyAsync(t => t.Id == territoryId && t.IsActive))
                return BadRequest(new { error = "That territory doesn't exist or is switched off." });

            // Rates left out come from the territory's new-event defaults.
            var settings = await SettingsStore.LoadAsync(DB, territoryId);
            var newEvent = new Event
            {
                TerritoryId = territoryId.Value,
                Organization = request.Organization.Trim(),
                EventDate = request.EventDate.Value.Date,
                CartName = request.CartName,
                SalesTaxRate = request.SalesTaxRate ?? settings.DefaultSalesTaxRate,
                CcProcessingFeeRate = request.CcProcessingFeeRate ?? settings.DefaultCcProcessingFeeRate,
                NextOrderNumber = request.NextOrderNumber ?? Event.FirstOrderNumber,
                IsActive = request.IsActive ?? true,
            };

            if (newEvent.IsActive)
                await DeactivateEventsAsync(newEvent.TerritoryId);

            DB.Events.Add(newEvent);
            await DB.SaveChangesAsync();

            return Ok(await LoadDtoAsync(newEvent.Id));
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists the events the signed-in user can see, most recent first: their territory's, or for
        /// a system admin or administrator every territory's (or the one they've picked).
        /// </summary>
        /// <returns>Events.</returns>
        [HttpGet("events")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetEvents()
        {
            var events = await DB.Events
                .Include(e => e.Territory)
                .AsNoTracking()
                .VisibleTo(Scope)
                .OrderByDescending(e => e.EventDate)
                .ThenByDescending(e => e.Id)
                .ToListAsync();

            return Ok(events.Select(ToDto).ToList());
        }

        /// <summary>
        /// Gets the event the floor sells under: the active event in the territory being worked.
        /// </summary>
        /// <returns>
        /// The active event, or 204 No Content when none is active - or, for a system admin or
        /// administrator, when no territory is picked. There is deliberately no fallback to the
        /// most recent event: with no active event, no new orders can be taken.
        /// </returns>
        [HttpGet("event/active")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetActiveEvent()
        {
            var territoryId = Scope.TerritoryId;
            if (territoryId == null)
                return NoContent();

            var active = await DB.Events
                .Include(e => e.Territory)
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.IsActive && e.TerritoryId == territoryId);

            // Not an error: "no event running right now" is a normal state between fundraisers.
            if (active == null)
                return NoContent();

            return Ok(ToDto(active));
        }

        /// <summary>
        /// Gets a single event, when it's in a territory the user can see.
        /// </summary>
        /// <param name="id">Event id</param>
        /// <returns>The event.</returns>
        [HttpGet("event/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetEvent(int id)
        {
            var dto = await LoadDtoAsync(id);
            if (dto == null || !Scope.CanSee(dto.TerritoryId))
                return NotFound(new { error = "Event not found." });

            return Ok(dto);
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Updates an event. Changing the tax rate only affects orders taken from that point on,
        /// because each order stores the rate it was written under. An event can't change
        /// territory once it has orders.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated event.</returns>
        [HttpPatch("event")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateEvent([FromBody] EventDto request)
        {
            if (!IsAtLeast(UserRole.Manager))
                return Forbidden(ManagersOnly);

            if (request.Id == null)
                return BadRequest(new { error = "Missing parameter." });

            var found = (await DB.Events.FindAsync(request.Id.Value)).IfVisibleTo(Scope);
            if (found == null)
                return NotFound(new { error = "Event not found." });

            if (request.Organization != null)
            {
                if (string.IsNullOrWhiteSpace(request.Organization) || request.Organization.Length > 150)
                    return BadRequest(new { error = "Invalid parameter." });

                found.Organization = request.Organization.Trim();
            }

            if (Rates.Problem(request.SalesTaxRate, request.CcProcessingFeeRate) is { } rateProblem)
                return BadRequest(new { error = rateProblem });

            if (request.TerritoryId != null && request.TerritoryId != found.TerritoryId)
            {
                if (!Scope.CanSee(request.TerritoryId))
                    return Forbidden("You can only move an event to one of your own territories.");
                if (await DB.Orders.AnyAsync(o => o.EventId == found.Id))
                    return BadRequest(new { error = "This event has orders, so it stays in its territory." });
                if (!await DB.Territories.AnyAsync(t => t.Id == request.TerritoryId && t.IsActive))
                    return BadRequest(new { error = "That territory doesn't exist or is switched off." });

                found.TerritoryId = request.TerritoryId.Value;
                found.IsActive = false;
            }

            if (request.CartName != null)
                found.CartName = request.CartName.Length > 100 ? request.CartName[..100] : request.CartName;

            if (request.EventDate != null)
                found.EventDate = request.EventDate.Value.Date;

            if (request.SalesTaxRate != null)
                found.SalesTaxRate = request.SalesTaxRate.Value;

            if (request.CcProcessingFeeRate != null)
                found.CcProcessingFeeRate = request.CcProcessingFeeRate.Value;

            if (request.NextOrderNumber != null)
            {
                if (request.NextOrderNumber < 1)
                    return BadRequest(new { error = "Order numbers start at 1." });
                found.NextOrderNumber = request.NextOrderNumber.Value;
            }

            if (request.IsActive == true && !found.IsActive)
            {
                if (!await DB.Territories.AnyAsync(t => t.Id == found.TerritoryId && t.IsActive))
                    return BadRequest(new { error = "This event's territory is switched off." });

                await DeactivateEventsAsync(found.TerritoryId);
                found.IsActive = true;
            }
            else if (request.IsActive == false)
            {
                found.IsActive = false;
            }

            await DB.SaveChangesAsync();

            return Ok(await LoadDtoAsync(found.Id));
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Deletes an event that has no orders against it. A system admin can pass permanent=true to delete
        /// an event together with every order taken at it.
        /// </summary>
        /// <param name="id">Event id</param>
        /// <param name="permanent">True to delete the event's orders too (system admin only)</param>
        /// <returns>200 when the event was removed.</returns>
        [HttpDelete("event/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteEvent(int id, [FromQuery] bool permanent = false)
        {
            if (!IsAtLeast(UserRole.Manager))
                return Forbidden("Only a manager, administrator or system admin may delete an event.");

            if (permanent && !IsSystemAdmin())
                return Forbidden("Only a system admin can delete an event with its orders.");

            var found = (await DB.Events.FindAsync(id)).IfVisibleTo(Scope);
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

        #endregion

        #region Private Methods

        /// <summary>
        /// Switches off every event in a territory, so the one being switched on is its only
        /// active event: a territory has one active event at a time.
        /// </summary>
        /// <param name="territoryId">The territory</param>
        private Task DeactivateEventsAsync(int territoryId) =>
            DB.Events.Where(e => e.TerritoryId == territoryId)
                .ExecuteUpdateAsync(e => e.SetProperty(x => x.IsActive, false));

        private async Task<EventDto?> LoadDtoAsync(int id)
        {
            var entity = await DB.Events.Include(e => e.Territory).AsNoTracking().FirstOrDefaultAsync(e => e.Id == id);
            return entity == null ? null : ToDto(entity);
        }

        /// <summary>
        /// Maps an event entity to its DTO.
        /// </summary>
        /// <param name="entity">Event entity, with Territory loaded</param>
        /// <returns>The mapped DTO.</returns>
        private static EventDto ToDto(Event entity)
        {
            return new EventDto
            {
                Id = entity.Id,
                TerritoryId = entity.TerritoryId,
                TerritoryName = entity.Territory?.Name,
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
