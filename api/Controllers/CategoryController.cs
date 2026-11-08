using System.Diagnostics;
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
    /// The categories a territory's products are listed under. Like delivery and financing options,
    /// every territory has its own list; a manager changes only their own territories'.
    /// Renaming or reordering categories never changes a past sale, which keeps each item's
    /// stat-sheet column, not its category.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class CategoryController(
        ApplicationDbContext db,
        ILogger<BasicController> logger)
        : CatalogItemController(db, logger)
    {
        #region Private Fields

        private const int MaxNameLength = CatalogRules.MaxCategoryNameLength;

        #endregion

        #region POST Methods

        /// <summary>
        /// Adds a category at the end of the list of the territory being worked (or the one given).
        /// </summary>
        /// <param name="request">Name and optionally the territory</param>
        /// <returns>The created category.</returns>
        [HttpPost("category")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> AddCategory([FromBody] CategoryDto request)
        {
            if (DenyUnlessManager() is { } notManager)
                return notManager;

            var (territoryId, problem) = await CatalogTerritoryAsync(request.TerritoryId);
            if (problem != null)
                return problem;

            var name = request.Name?.Trim() ?? "";
            if (await NameProblemAsync(name, territoryId, null) is { } nameProblem)
                return BadRequest(new { error = nameProblem });

            var category = new Category
            {
                TerritoryId = territoryId,
                Name = name,
                SortOrder = (await DB.Categories.Where(c => c.TerritoryId == territoryId).MaxAsync(c => (int?)c.SortOrder) ?? 0) + 1,
            };
            DB.Categories.Add(category);
            await DB.SaveChangesAsync();

            return Ok(await LoadDtoAsync(category.Id));
        }

        #endregion

        #region GET Methods

        /// <summary>
        /// Lists the categories of the territory being worked - or of all the user's territories,
        /// each naming its own, when none is picked - in tab order.
        /// </summary>
        /// <param name="territoryId">A territory to list for instead of the one in view</param>
        /// <returns>Categories in tab order.</returns>
        [HttpGet("categories")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetCategories([FromQuery] int? territoryId = null)
        {
            if (territoryId != null && !Scope.CanSee(territoryId))
                return Forbidden("You can't see that territory.");

            return Ok(await ListAsync(territoryId is { } one ? [one] : Scope.VisibleTerritoryIds));
        }

        #endregion

        #region PATCH Methods

        /// <summary>
        /// Renames a category.
        /// </summary>
        /// <param name="request">Fields to change, including the id</param>
        /// <returns>The updated category.</returns>
        [HttpPatch("category")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> UpdateCategory([FromBody] CategoryDto request)
        {
            if (DenyUnlessManager() is { } notManager)
                return notManager;

            if (request.Id == null)
                return BadRequest(new { error = "Missing parameter." });

            var category = (await DB.Categories.FindAsync(request.Id.Value)).IfVisibleTo(Scope);
            if (category == null)
                return NotFound(new { error = "Category not found." });

            if (DenyUnlessEditable(category.TerritoryId) is { } notEditable)
                return notEditable;

            var name = request.Name?.Trim() ?? category.Name;
            if (await NameProblemAsync(name, category.TerritoryId, category.Id) is { } nameProblem)
                return BadRequest(new { error = nameProblem });

            category.Name = name;
            await DB.SaveChangesAsync();

            return Ok(await LoadDtoAsync(category.Id));
        }

        #endregion

        #region PUT Methods

        /// <summary>
        /// Puts one territory's categories in a new order, the order of the tabs.
        /// </summary>
        /// <param name="ids">Every category id of that list, in the new order</param>
        /// <returns>The categories as the catalog screen lists them.</returns>
        [HttpPut("categories/order")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> ReorderCategories([FromBody] List<int> ids)
        {
            if (await ReorderAsync(ids, id => DB.Categories.FindAsync(id), territoryId => DB.Categories.Where(c => c.TerritoryId == territoryId).ToListAsync()) is { } problem)
                return problem;

            return Ok(await ListAsync(Scope.VisibleTerritoryIds));
        }

        #endregion

        #region DELETE Methods

        /// <summary>
        /// Removes an empty category. One with products in it, archived ones included, is refused
        /// until they are moved to another category, so no item is ever lost with its category.
        /// </summary>
        /// <param name="id">Category id</param>
        /// <returns>200 when removed.</returns>
        [HttpDelete("category/{id}")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> DeleteCategory(int id)
        {
            if (DenyUnlessManager() is { } notManager)
                return notManager;

            var category = (await DB.Categories.FindAsync(id)).IfVisibleTo(Scope);
            if (category == null)
                return NotFound(new { error = "Category not found." });

            if (DenyUnlessEditable(category.TerritoryId) is { } notEditable)
                return notEditable;

            var count = await DB.Products.CountAsync(p => p.CategoryId == id);
            if (count > 0)
                return BadRequest(new { error = $"Move the {count} {(count == 1 ? "item" : "items")} in {category.Name} to another category first, archived ones included." });

            if (!await DB.Categories.AnyAsync(c => c.TerritoryId == category.TerritoryId && c.Id != id))
                return BadRequest(new { error = "A catalog needs at least one category." });

            DB.Categories.Remove(category);
            await DB.SaveChangesAsync();

            Trace(TraceEventType.Information, $"{GetCurrentUserName()} deleted the category {category.Name}.");
            return Ok();
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// The categories of the territories given - every territory's when null - each territory's
        /// in tab order.
        /// </summary>
        private async Task<List<CategoryDto>> ListAsync(List<int>? territories)
        {
            var categories = await DB.Categories
                .AsNoTracking()
                .InTerritories(territories)
                .Select(c => new { Category = c, TerritoryName = c.Territory!.Name, ProductCount = c.Products.Count })
                .ToListAsync();

            return categories
                .OrderBy(c => c.TerritoryName)
                .ThenBy(c => c.Category.SortOrder)
                .ThenBy(c => c.Category.Name)
                .Select(c => ToDto(c.Category, c.TerritoryName, c.ProductCount))
                .ToList();
        }

        private async Task<CategoryDto?> LoadDtoAsync(int id)
        {
            var found = await DB.Categories
                .AsNoTracking()
                .Where(c => c.Id == id)
                .Select(c => new { Category = c, TerritoryName = c.Territory!.Name, ProductCount = c.Products.Count })
                .FirstOrDefaultAsync();
            return found == null ? null : ToDto(found.Category, found.TerritoryName, found.ProductCount);
        }

        private CategoryDto ToDto(Category category, string? territoryName, int productCount) => new()
        {
            Id = category.Id,
            TerritoryId = category.TerritoryId,
            TerritoryName = territoryName,
            CanEdit = CanEditCatalog(category.TerritoryId),
            Name = category.Name,
            SortOrder = category.SortOrder,
            ProductCount = productCount,
        };

        /// <summary>
        /// Why a name can't be used in this territory's list: blank, too long, "All" (the tab that
        /// shows every category), or another category's.
        /// </summary>
        private async Task<string?> NameProblemAsync(string name, int? territoryId, int? exceptId)
        {
            if (name.Length == 0)
                return "Enter a name.";
            if (name.Length > MaxNameLength)
                return $"The name can be at most {MaxNameLength} characters.";
            if (CatalogRules.SameName(name, CatalogRules.AllCategoriesTab))
                return "\"All\" is the tab that shows every category. Choose another name.";

            var lower = name.ToLower();
            if (await DB.Categories.AnyAsync(c => c.TerritoryId == territoryId && c.Id != exceptId && c.Name.ToLower() == lower))
                return "There is already a category with that name.";
            return null;
        }

        #endregion
    }
}
