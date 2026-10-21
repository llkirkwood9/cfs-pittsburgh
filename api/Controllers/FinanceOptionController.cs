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
    /// The kinds of financing offered at checkout, kept in the catalog. Like delivery options, an
    /// option is either global (every territory) or one territory's own; a manager changes only
    /// their territory's. A financing payment stores the name it was recorded with, so options can
    /// be renamed, switched off or removed freely.
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

        private const string CatalogOnly = "Only a manager, administrator or system admin may change the catalog.";

        private const string GlobalReadOnly = "Global financing options can only be changed by a system admin or administrator.";

        private const int MaxNameLength = 100;

        #endregion

        #region POST Methods

        /// <summary>
        /// Adds a finance option at the end of its territory's list - the manager's territory, or
        /// for a system admin or administrator either global or a territory they pick.
        /// </summary>
        /// <param name="request">Name, territory, and optionally whether it is offered</param>
        /// <returns>The created option.</returns>
        [HttpPost("financeoption")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddFinanceOption([FromBody] FinanceOptionDto request)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden(CatalogOnly);

                var name = request.Name?.Trim();
                if (string.IsNullOrEmpty(name))
                    return BadRequest(new { error = "Enter a name." });

                if (name.Length > MaxNameLength)
                    return BadRequest(new { error = $"The name can be at most {MaxNameLength} characters." });

                var (territoryId, problem) = await CatalogTerritoryAsync(request.TerritoryId);
                if (problem != null)
                    return problem;

                if (await NameClashesAsync(name, territoryId, null))
                    return BadRequest(new { error = "A financing option with that name already exists." });

                var option = new FinanceOption
                {
                    Name = name,
                    TerritoryId = territoryId,
                    IsActive = request.IsActive ?? true,
                    SortOrder = await NextSortOrderAsync(territoryId),
                };

                DB.FinanceOptions.Add(option);
                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(option.Id));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while adding the financing option.", e);
            }
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists the finance options a territory offers - global ones first, then its own - or
        /// every option for a system admin or administrator viewing every territory. Anyone signed
        /// in may read them; checkout needs them.
        /// </summary>
        /// <param name="includeInactive">Pass true from the catalog screen</param>
        /// <param name="territoryId">A territory to list for instead of the one in view, such as an order's</param>
        /// <returns>Finance options in display order.</returns>
        [HttpGet("financeoptions")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetFinanceOptions([FromQuery] bool includeInactive = false, [FromQuery] int? territoryId = null)
        {
            try
            {
                if (territoryId != null && !Scope.CanSee(territoryId))
                    return Forbidden("You can't see that territory.");

                return Ok(await ListAsync(territoryId ?? Scope.TerritoryId, includeInactive));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while getting financing options.", e);
            }
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Renames a finance option or switches it on or off at checkout. A system admin or
        /// administrator may also move it between global and a territory.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated option.</returns>
        [HttpPatch("financeoption")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateFinanceOption([FromBody] FinanceOptionDto request)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden(CatalogOnly);

                if (request.Id == null)
                    return BadRequest(new { error = "Missing parameter." });

                var option = await DB.FinanceOptions.FindAsync(request.Id.Value);
                if (option == null || !InCatalog(option.TerritoryId, Scope.IsCompanyWide ? null : Scope.HomeTerritoryId))
                    return NotFound(new { error = "Financing option not found." });

                if (!CanEditCatalog(option.TerritoryId))
                    return Forbidden(GlobalReadOnly);

                // The edit form always sends the name and the territory, null meaning global; a
                // partial update without a name leaves the territory alone.
                var territoryId = option.TerritoryId;
                if (Scope.IsCompanyWide && request.Name != null && request.TerritoryId != option.TerritoryId)
                {
                    (territoryId, var problem) = await CatalogTerritoryAsync(request.TerritoryId);
                    if (problem != null)
                        return problem;
                }

                var name = request.Name?.Trim() ?? option.Name;
                if (name.Length == 0)
                    return BadRequest(new { error = "Enter a name." });

                if (name.Length > MaxNameLength)
                    return BadRequest(new { error = $"The name can be at most {MaxNameLength} characters." });

                if (await NameClashesAsync(name, territoryId, option.Id))
                    return BadRequest(new { error = "A financing option with that name already exists." });

                if (territoryId != option.TerritoryId)
                {
                    option.SortOrder = await NextSortOrderAsync(territoryId);
                    option.TerritoryId = territoryId;
                }

                option.Name = name;

                if (request.IsActive != null)
                    option.IsActive = request.IsActive.Value;

                await DB.SaveChangesAsync();

                return Ok(await LoadDtoAsync(option.Id));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while updating the financing option.", e);
            }
        }

        #endregion

        #region PUT Methods

        /// <summary>
        /// Puts one list of finance options in a new order: the global ones, or one territory's own.
        /// Global options always come before a territory's own at checkout.
        /// </summary>
        /// <param name="ids">Every option id of that list, in the order checkout should show them</param>
        /// <returns>The options as the catalog screen lists them.</returns>
        [HttpPut("financeoptions/order")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> ReorderFinanceOptions([FromBody] List<int> ids)
        {
            try
            {
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden(CatalogOnly);

                if (ids.Count == 0 || ids.Distinct().Count() != ids.Count)
                    return BadRequest(new { error = "Invalid parameter." });

                var first = await DB.FinanceOptions.FindAsync(ids[0]);
                if (first == null)
                    return BadRequest(new { error = "The list has changed. Refresh and try again." });

                var group = await DB.FinanceOptions.Where(f => f.TerritoryId == first.TerritoryId).ToListAsync();
                if (group.Count != ids.Count || group.Any(o => !ids.Contains(o.Id)))
                    return BadRequest(new { error = "The list has changed. Refresh and try again." });

                if (!CanEditCatalog(first.TerritoryId))
                    return Forbidden(GlobalReadOnly);

                foreach (var option in group)
                    option.SortOrder = ids.IndexOf(option.Id) + 1;

                await DB.SaveChangesAsync();

                return Ok(await ListAsync(Scope.TerritoryId, includeInactive: true));
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while reordering the financing options.", e);
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
                if (!IsAtLeast(UserRole.Manager))
                    return Forbidden(CatalogOnly);

                var option = await DB.FinanceOptions.FindAsync(id);
                if (option == null || !InCatalog(option.TerritoryId, Scope.IsCompanyWide ? null : Scope.HomeTerritoryId))
                    return NotFound(new { error = "Financing option not found." });

                if (!CanEditCatalog(option.TerritoryId))
                    return Forbidden(GlobalReadOnly);

                DB.FinanceOptions.Remove(option);
                await DB.SaveChangesAsync();

                return Ok();
            }
            catch (Exception e)
            {
                return ServerError("Internal error occurred while deleting the financing option.", e);
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// The options a territory offers - global first, then its own - or every option when no
        /// territory is given.
        /// </summary>
        private async Task<List<FinanceOptionDto>> ListAsync(int? territoryId, bool includeInactive)
        {
            var query = DB.FinanceOptions.Include(f => f.Territory).AsNoTracking()
                .Where(f => territoryId == null || f.TerritoryId == null || f.TerritoryId == territoryId);

            if (!includeInactive)
                query = query.Where(f => f.IsActive);

            var options = await query.ToListAsync();
            return options
                .OrderBy(f => f.TerritoryId != null)
                .ThenBy(f => f.Territory?.Name)
                .ThenBy(f => f.SortOrder)
                .ThenBy(f => f.Name)
                .Select(ToDto)
                .ToList();
        }

        /// <summary>
        /// Whether a name is already used by an option the same territory would see: a global
        /// option's name has to be unique everywhere; a territory option's among the global ones
        /// and that territory's own.
        /// </summary>
        private Task<bool> NameClashesAsync(string name, int? territoryId, int? exceptId)
        {
            var lower = name.Trim().ToLower();
            return DB.FinanceOptions.AnyAsync(f => f.Name.ToLower() == lower
                                                   && f.Id != exceptId
                                                   && (territoryId == null || f.TerritoryId == null || f.TerritoryId == territoryId));
        }

        /// <summary>
        /// The sort order for an option added at the end of its territory's list.
        /// </summary>
        private async Task<int> NextSortOrderAsync(int? territoryId) =>
            (await DB.FinanceOptions.Where(f => f.TerritoryId == territoryId).MaxAsync(f => (int?)f.SortOrder) ?? 0) + 1;

        private async Task<FinanceOptionDto?> LoadDtoAsync(int id)
        {
            var option = await DB.FinanceOptions.Include(f => f.Territory).AsNoTracking().FirstOrDefaultAsync(f => f.Id == id);
            return option == null ? null : ToDto(option);
        }

        /// <summary>
        /// Maps a finance option entity to its DTO.
        /// </summary>
        /// <param name="option">Finance option entity, with Territory loaded</param>
        /// <returns>The mapped DTO.</returns>
        private FinanceOptionDto ToDto(FinanceOption option)
        {
            return new FinanceOptionDto
            {
                Id = option.Id,
                TerritoryId = option.TerritoryId,
                TerritoryName = option.Territory?.Name,
                CanEdit = CanEditCatalog(option.TerritoryId),
                Name = option.Name,
                SortOrder = option.SortOrder,
                IsActive = option.IsActive,
            };
        }

        #endregion
    }
}
