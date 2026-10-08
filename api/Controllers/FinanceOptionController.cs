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
    /// The kinds of financing offered at checkout, kept in the catalog. A financing payment stores
    /// the name it was recorded with, so options can be renamed, switched off or removed freely.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class FinanceOptionController(
        ApplicationDbContext db,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BasicController> logger,
        TokenService tokenService)
        : BasicController(db, httpClientFactory, config, logger, tokenService)
    {
        #region Private Fields

        private const string AdminOnly = "Only an administrator may change the finance options.";

        private const int MaxNameLength = 100;

        #endregion

        #region POST Methods

        /// <summary>
        /// Adds a finance option at the end of the list.
        /// </summary>
        /// <param name="request">Name, and optionally whether it is offered</param>
        /// <returns>The created option.</returns>
        [HttpPost("financeoption")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddFinanceOption([FromBody] FinanceOptionDto request)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = AdminOnly });

                var name = request.Name?.Trim();
                if (string.IsNullOrEmpty(name))
                    return BadRequest(new { error = "Enter a name." });

                if (name.Length > MaxNameLength)
                    return BadRequest(new { error = $"The name can be at most {MaxNameLength} characters." });

                if (await NameTakenAsync(name, null))
                    return BadRequest(new { error = "A finance option with that name already exists." });

                var option = new FinanceOption
                {
                    Name = name,
                    IsActive = request.IsActive ?? true,
                    SortOrder = (await DB.FinanceOptions.MaxAsync(f => (int?)f.SortOrder) ?? 0) + 1,
                };

                DB.FinanceOptions.Add(option);
                await DB.SaveChangesAsync();

                return Ok(ToDto(option));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while adding the finance option.", exception = e.Message });
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists the finance options. Anyone signed in may read them; checkout needs them.
        /// </summary>
        /// <param name="includeInactive">Pass true from the catalog screen</param>
        /// <returns>Finance options in display order.</returns>
        [HttpGet("financeoptions")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetFinanceOptions([FromQuery] bool includeInactive = false)
        {
            try
            {
                var query = DB.FinanceOptions.AsNoTracking().AsQueryable();

                if (!includeInactive)
                    query = query.Where(f => f.IsActive);

                var options = await query
                    .OrderBy(f => f.SortOrder)
                    .ThenBy(f => f.Name)
                    .ToListAsync();

                return Ok(options.Select(ToDto).ToList());
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while getting finance options.", exception = e.Message });
            }
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Renames a finance option or switches it on or off at checkout.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated option.</returns>
        [HttpPatch("financeoption")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateFinanceOption([FromBody] FinanceOptionDto request)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = AdminOnly });

                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var option = await DB.FinanceOptions.FindAsync(request.Id.Value);
                if (option == null)
                    return NotFound(new { error = "Finance option not found." });

                if (request.Name != null)
                {
                    var name = request.Name.Trim();
                    if (name.Length == 0)
                        return BadRequest(new { error = "Enter a name." });

                    if (name.Length > MaxNameLength)
                        return BadRequest(new { error = $"The name can be at most {MaxNameLength} characters." });

                    if (await NameTakenAsync(name, option.Id))
                        return BadRequest(new { error = "A finance option with that name already exists." });

                    option.Name = name;
                }

                if (request.IsActive != null)
                    option.IsActive = request.IsActive.Value;

                await DB.SaveChangesAsync();

                return Ok(ToDto(option));
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while updating the finance option.", exception = e.Message });
            }
        }

        #endregion

        #region PUT Methods

        /// <summary>
        /// Puts the finance options in a new order.
        /// </summary>
        /// <param name="ids">Every option id, in the order checkout should list them</param>
        /// <returns>The options in their new order.</returns>
        [HttpPut("financeoptions/order")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> ReorderFinanceOptions([FromBody] List<int> ids)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = AdminOnly });

                var options = await DB.FinanceOptions.ToListAsync();
                if (ids.Count != options.Count || ids.Distinct().Count() != ids.Count || options.Any(o => !ids.Contains(o.Id)))
                    return BadRequest(new { error = "The list has changed. Refresh and try again." });

                foreach (var option in options)
                    option.SortOrder = ids.IndexOf(option.Id) + 1;

                await DB.SaveChangesAsync();

                return Ok(options.OrderBy(o => o.SortOrder).Select(ToDto).ToList());
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while reordering the finance options.", exception = e.Message });
            }
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Removes a finance option. Sales already recorded with it keep its name.
        /// </summary>
        /// <param name="id">Finance option id</param>
        /// <returns>200 when removed.</returns>
        [HttpDelete("financeoption/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteFinanceOption(int id)
        {
            try
            {
                if (!IsInRole(UserRole.Admin))
                    return StatusCode(403, new { error = AdminOnly });

                var option = await DB.FinanceOptions.FindAsync(id);
                if (option == null)
                    return NotFound(new { error = "Finance option not found." });

                DB.FinanceOptions.Remove(option);
                await DB.SaveChangesAsync();

                return Ok();
            }
            catch (Exception e)
            {
                Trace(TraceEventType.Critical, e.Message);
                return StatusCode(500, new { error = "Internal error occurred while deleting the finance option.", exception = e.Message });
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Whether another option already has this name, ignoring case.
        /// </summary>
        /// <param name="name">Trimmed name</param>
        /// <param name="exceptId">The option being renamed, if any</param>
        /// <returns>True when taken.</returns>
        private Task<bool> NameTakenAsync(string name, int? exceptId)
        {
            var lower = name.ToLower();
            return DB.FinanceOptions.AnyAsync(f => f.Name.ToLower() == lower && f.Id != exceptId);
        }

        /// <summary>
        /// Maps a finance option entity to its DTO.
        /// </summary>
        /// <param name="option">Finance option entity</param>
        /// <returns>The mapped DTO.</returns>
        private static FinanceOptionDto ToDto(FinanceOption option)
        {
            return new FinanceOptionDto
            {
                Id = option.Id,
                Name = option.Name,
                SortOrder = option.SortOrder,
                IsActive = option.IsActive,
            };
        }

        #endregion
    }
}
