using api.Catalog;
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
    /// The kinds of financing offered at checkout, kept in the catalog. Like delivery options,
    /// every territory has its own; a manager changes only their own territories'. A financing payment stores the name it was recorded with, so options can
    /// be renamed, switched off or removed freely.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class FinanceOptionController(
        ApplicationDbContext db,
        ILogger<BasicController> logger)
        : CatalogItemController(db, logger)
    {
        #region Private Fields

        private const int MaxNameLength = CatalogRules.MaxFinanceNameLength;

        #endregion

        #region POST Methods

        /// <summary>
        /// Adds a finance option at the end of the list of the territory being worked.
        /// </summary>
        /// <param name="request">Name, territory, and optionally whether it is offered</param>
        /// <returns>The created option.</returns>
        [HttpPost("financeoption")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddFinanceOption([FromBody] FinanceOptionDto request)
        {
            if (DenyUnlessManager() is { } notManager)
                return notManager;

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

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists the finance options of the territory being worked - or of all the user's
        /// territories, each naming its own, when none is picked. Anyone signed in may read them;
        /// checkout needs them.
        /// </summary>
        /// <param name="includeInactive">Pass true from the catalog screen</param>
        /// <param name="territoryId">A territory to list for instead of the one in view, such as an order's</param>
        /// <returns>Finance options in display order.</returns>
        [HttpGet("financeoptions")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetFinanceOptions([FromQuery] bool includeInactive = false, [FromQuery] int? territoryId = null)
        {
            if (territoryId != null && !Scope.CanSee(territoryId))
                return Forbidden("You can't see that territory.");

            return Ok(await ListAsync(territoryId is { } one ? [one] : Scope.VisibleTerritoryIds, includeInactive));
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Renames a finance option or switches it on or off at checkout. It stays in its
        /// territory's catalog.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated option.</returns>
        [HttpPatch("financeoption")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateFinanceOption([FromBody] FinanceOptionDto request)
        {
            if (DenyUnlessManager() is { } notManager)
                return notManager;

            if (request.Id == null)
                return BadRequest(new { error = "Missing parameter." });

            var option = (await DB.FinanceOptions.FindAsync(request.Id.Value)).IfVisibleTo(Scope);
            if (option == null)
                return NotFound(new { error = "Financing option not found." });

            if (DenyUnlessEditable(option.TerritoryId) is { } notEditable)
                return notEditable;

            var territoryId = option.TerritoryId;
            var name = request.Name?.Trim() ?? option.Name;
            if (name.Length == 0)
                return BadRequest(new { error = "Enter a name." });

            if (name.Length > MaxNameLength)
                return BadRequest(new { error = $"The name can be at most {MaxNameLength} characters." });

            if (await NameClashesAsync(name, territoryId, option.Id))
                return BadRequest(new { error = "A financing option with that name already exists." });

            option.Name = name;

            if (request.IsActive != null)
                option.IsActive = request.IsActive.Value;

            await DB.SaveChangesAsync();

            return Ok(await LoadDtoAsync(option.Id));
        }

        #endregion

        #region PUT Methods

        /// <summary>
        /// Puts one territory's finance options in a new order, the order checkout lists them in.
        /// </summary>
        /// <param name="ids">Every option id of that list, in the order checkout should show them</param>
        /// <returns>The options as the catalog screen lists them.</returns>
        [HttpPut("financeoptions/order")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> ReorderFinanceOptions([FromBody] List<int> ids)
        {
            if (await ReorderAsync(ids, id => DB.FinanceOptions.FindAsync(id), territoryId => DB.FinanceOptions.Where(f => f.TerritoryId == territoryId).ToListAsync()) is { } problem)
                return problem;

            return Ok(await ListAsync(Scope.VisibleTerritoryIds, includeInactive: true));
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
            if (DenyUnlessManager() is { } notManager)
                return notManager;

            var option = (await DB.FinanceOptions.FindAsync(id)).IfVisibleTo(Scope);
            if (option == null)
                return NotFound(new { error = "Financing option not found." });

            if (DenyUnlessEditable(option.TerritoryId) is { } notEditable)
                return notEditable;

            DB.FinanceOptions.Remove(option);
            await DB.SaveChangesAsync();

            return Ok();
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// The options of the territories given - every territory's when null - each territory's in
        /// its order.
        /// </summary>
        private async Task<List<FinanceOptionDto>> ListAsync(List<int>? territories, bool includeInactive)
        {
            var query = DB.FinanceOptions.Include(f => f.Territory).AsNoTracking().InTerritories(territories);

            if (!includeInactive)
                query = query.Where(f => f.IsActive);

            var options = await query.ToListAsync();
            return options
                .OrderBy(f => f.Territory?.Name)
                .ThenBy(f => f.SortOrder)
                .ThenBy(f => f.Name)
                .Select(ToDto)
                .ToList();
        }

        /// <summary>
        /// Whether a name is already used by another option in the same territory's catalog.
        /// </summary>
        private Task<bool> NameClashesAsync(string name, int? territoryId, int? exceptId)
        {
            var lower = name.Trim().ToLower();
            return DB.FinanceOptions.AnyAsync(f => f.Name.ToLower() == lower
                                                   && f.Id != exceptId
                                                   && f.TerritoryId == territoryId);
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
