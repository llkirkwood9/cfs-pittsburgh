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
    /// Sales territories. System Admins and administrators create, rename and switch them off; everyone
    /// can list the ones they can see (company-wide users all, everyone else their own).
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class TerritoryController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region Private Fields

        private const string AdminOnly = "Only a system admin or administrator may manage territories.";

        #endregion

        #region GET Methods

        /// <summary>
        /// The territories the signed-in user can see, by name.
        /// </summary>
        /// <param name="includeInactive">Include switched-off territories (company-wide users only)</param>
        /// <returns>Territories with their counts.</returns>
        [HttpGet("territories")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetTerritories([FromQuery] bool includeInactive = false)
        {
            try
            {
                var scope = Scope;
                var query = DB.Territories.AsNoTracking().AsQueryable();
                if (!scope.IsCompanyWide)
                    query = query.Where(t => t.Id == scope.HomeTerritoryId);
                else if (!includeInactive)
                    query = query.Where(t => t.IsActive);

                var territories = await query.OrderBy(t => t.Name).ToListAsync();
                var ids = territories.Select(t => t.Id).ToList();

                var users = await DB.Users.Where(u => u.TerritoryId != null && ids.Contains(u.TerritoryId.Value) && u.IsActive)
                    .GroupBy(u => u.TerritoryId!.Value).Select(g => new { g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.Key, x => x.Count);
                var events = await DB.Events.Where(e => ids.Contains(e.TerritoryId))
                    .GroupBy(e => e.TerritoryId).Select(g => new { g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.Key, x => x.Count);
                var products = await DB.Products.Where(p => p.TerritoryId != null && ids.Contains(p.TerritoryId.Value) && p.IsActive)
                    .GroupBy(p => p.TerritoryId!.Value).Select(g => new { g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.Key, x => x.Count);
                var active = await DB.Events.Where(e => ids.Contains(e.TerritoryId) && e.IsActive)
                    .Select(e => new { e.TerritoryId, e.Organization })
                    .ToListAsync();

                return Ok(territories.Select(t => new TerritoryDto
                {
                    Id = t.Id,
                    Name = t.Name,
                    IsActive = t.IsActive,
                    CreatedAt = t.CreatedAt,
                    UserCount = users.GetValueOrDefault(t.Id),
                    EventCount = events.GetValueOrDefault(t.Id),
                    ProductCount = products.GetValueOrDefault(t.Id),
                    ActiveEvent = active.FirstOrDefault(a => a.TerritoryId == t.Id)?.Organization,
                }).ToList());
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting territories.", e);
            }
        }

        #endregion

        #region POST Methods

        /// <summary>
        /// Adds a territory.
        /// </summary>
        /// <param name="request">Its name</param>
        /// <returns>The created territory.</returns>
        [HttpPost("territory")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddTerritory([FromBody] TerritoryDto request)
        {
            try
            {
                if (!Scope.IsCompanyWide)
                    return Forbidden(AdminOnly);

                var name = request.Name?.Trim();
                if (string.IsNullOrWhiteSpace(name) || name.Length > 100)
                    return BadRequest(new { error = "Enter a territory name of up to 100 characters." });

                var lower = name.ToLower();
                if (await DB.Territories.AnyAsync(t => t.Name.ToLower() == lower))
                    return BadRequest(new { error = "There is already a territory with that name." });

                var territory = new Territory { Name = name, IsActive = request.IsActive ?? true };
                DB.Territories.Add(territory);
                await DB.SaveChangesAsync();

                Trace(TraceEventType.Information, $"Territory {territory.Name} added by {GetCurrentUserName()}.");
                return Ok(new TerritoryDto { Id = territory.Id, Name = territory.Name, IsActive = territory.IsActive, CreatedAt = territory.CreatedAt });
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while adding the territory.", e);
            }
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Renames a territory or switches it on or off. Switching it off signs its crew out and
        /// stops its active event.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated territory.</returns>
        [HttpPatch("territory")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateTerritory([FromBody] TerritoryDto request)
        {
            try
            {
                if (!Scope.IsCompanyWide)
                    return Forbidden(AdminOnly);

                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var territory = await DB.Territories.FindAsync(request.Id.Value);
                if (territory == null)
                    return NotFound(new { error = "Territory not found." });

                if (request.Name != null)
                {
                    var name = request.Name.Trim();
                    if (name.Length == 0 || name.Length > 100)
                        return BadRequest(new { error = "Enter a territory name of up to 100 characters." });

                    var lower = name.ToLower();
                    if (await DB.Territories.AnyAsync(t => t.Id != territory.Id && t.Name.ToLower() == lower))
                        return BadRequest(new { error = "There is already a territory with that name." });

                    territory.Name = name;
                }

                if (request.IsActive != null && request.IsActive.Value != territory.IsActive)
                {
                    territory.IsActive = request.IsActive.Value;
                    if (!territory.IsActive)
                    {
                        // Its crew are signed out at their next request; its sale stops taking orders.
                        await DB.UserSessions.Where(s => s.User!.TerritoryId == territory.Id).ExecuteDeleteAsync();
                        await DB.Events.Where(e => e.TerritoryId == territory.Id && e.IsActive)
                            .ExecuteUpdateAsync(s => s.SetProperty(e => e.IsActive, false));
                    }
                }

                await DB.SaveChangesAsync();
                Trace(TraceEventType.Information, $"Territory {territory.Name} changed by {GetCurrentUserName()}.");
                return Ok(new TerritoryDto { Id = territory.Id, Name = territory.Name, IsActive = territory.IsActive, CreatedAt = territory.CreatedAt });
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while updating the territory.", e);
            }
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Deletes a territory that has nothing in it yet - no crew, events or catalog items. One
        /// that's been used is switched off instead, so its history stays.
        /// </summary>
        /// <param name="id">Territory id</param>
        /// <returns>200, or 400 explaining what's still in it.</returns>
        [HttpDelete("territory/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteTerritory(int id)
        {
            try
            {
                if (!Scope.IsCompanyWide)
                    return Forbidden(AdminOnly);

                var territory = await DB.Territories.FindAsync(id);
                if (territory == null)
                    return NotFound(new { error = "Territory not found." });

                var inUse = await DB.Users.AnyAsync(u => u.TerritoryId == id)
                            || await DB.Events.AnyAsync(e => e.TerritoryId == id)
                            || await DB.Products.AnyAsync(p => p.TerritoryId == id)
                            || await DB.DeliveryOptions.AnyAsync(d => d.TerritoryId == id);
                if (inUse)
                    return BadRequest(new { error = "This territory has crew, events or catalog items. Switch it off instead - its history stays on file." });

                await DB.InventoryAdjustments.Where(a => a.TerritoryId == id).ExecuteDeleteAsync();
                DB.Territories.Remove(territory);
                await DB.SaveChangesAsync();

                Trace(TraceEventType.Information, $"Territory {territory.Name} deleted by {GetCurrentUserName()}.");
                return Ok();
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while deleting the territory.", e);
            }
        }

        #endregion
    }
}
