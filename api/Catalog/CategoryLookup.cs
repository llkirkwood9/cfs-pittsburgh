using Microsoft.EntityFrameworkCore;
using api.Data;
using api.Models;

namespace api.Catalog
{
    /// <summary>
    /// Finds a territory's category by name, adding it when the territory has none of that name.
    /// Everything that brings products into a catalog from elsewhere - a copy from another
    /// territory, a catalog file, the sample catalog - goes through it, so categories always match
    /// up by name and a missing one is created the same way.
    /// </summary>
    /// <param name="db">EF context; categories it adds are tracked, saved with the caller's changes</param>
    public sealed class CategoryLookup(ApplicationDbContext db)
    {
        #region Public Fields

        /// <summary>
        /// The categories every territory starts with, in tab order: one for each stat-sheet column.
        /// The upgrade to named categories gave each territory these, so its items kept their place.
        /// </summary>
        public static readonly IReadOnlyList<(string Name, StatColumn StatColumn)> Defaults =
        [
            ("Mattresses", StatColumn.Mattress),
            ("Adjustable Bases", StatColumn.AdjustableBase),
            ("Pillows", StatColumn.Pillow),
            ("Sheets", StatColumn.Sheets),
            ("Mattress Protectors", StatColumn.MattressProtector),
            ("Frames", StatColumn.Frame),
            ("Bean Bag Chairs", StatColumn.BeanBagChair),
            ("Other", StatColumn.Misc),
        ];

        #endregion

        #region Private Fields

        private readonly Dictionary<int, List<Category>> _byTerritory = new();

        #endregion

        #region Public Properties

        /// <summary>
        /// The names of the categories this lookup added, for telling the user.
        /// </summary>
        public List<string> Added { get; } = new();

        #endregion

        #region Public Methods

        /// <summary>
        /// Gives a territory the default categories it doesn't already have one of the same name.
        /// </summary>
        /// <param name="territoryId">The territory</param>
        public async Task AddDefaultsAsync(int territoryId)
        {
            foreach (var (name, column) in Defaults)
                await ForAsync(territoryId, name, column);
        }

        /// <summary>
        /// The territory's category of this name, added at the end of its list when it has none.
        /// </summary>
        /// <param name="territoryId">The territory</param>
        /// <param name="name">The category's name</param>
        /// <param name="statColumn">The column a category added for it counts in; when not given,
        /// the old column a name like "Mattress" stands for, or else Misc</param>
        /// <returns>The category, tracked.</returns>
        public async Task<Category> ForAsync(int territoryId, string? name, StatColumn? statColumn = null)
        {
            var match = await FindAsync(territoryId, name, oldNames: statColumn == null);
            if (match != null)
                return match;

            var trimmed = name?.Trim() ?? "";
            if (statColumn == null && OldColumnName(trimmed) is { } column)
                return Add(territoryId, Defaults.First(d => d.StatColumn == column).Name, column);
            return Add(territoryId, trimmed.Length == 0 ? "Other" : trimmed, statColumn ?? StatColumn.Misc);
        }

        /// <summary>
        /// The territory's category of this name, or null when it has none. A name from before
        /// categories could be named - "Mattress", "AdjustableBase", as older catalog files, the
        /// sample catalog and older copies of the apps send - finds the category that counts in
        /// that stat-sheet column.
        /// </summary>
        /// <param name="territoryId">The territory</param>
        /// <param name="name">The category's name</param>
        /// <param name="oldNames">Whether an old name finds its stat-sheet column's category</param>
        /// <returns>The category, tracked, or null.</returns>
        public async Task<Category?> FindAsync(int territoryId, string? name, bool oldNames = true)
        {
            var list = await ListAsync(territoryId);
            var trimmed = name?.Trim() ?? "";

            var match = list.FirstOrDefault(c => CatalogRules.SameName(c.Name, trimmed));
            if (match != null || !oldNames || OldColumnName(trimmed) is not { } column)
                return match;

            var defaultName = Defaults.First(d => d.StatColumn == column).Name;
            return list.FirstOrDefault(c => CatalogRules.SameName(c.Name, defaultName))
                   ?? list.Where(c => c.StatColumn == column).OrderBy(c => c.SortOrder).ThenBy(c => c.Id).FirstOrDefault();
        }

        #endregion

        #region Private Methods

        private async Task<List<Category>> ListAsync(int territoryId)
        {
            if (!_byTerritory.TryGetValue(territoryId, out var list))
            {
                list = await db.Categories.Where(c => c.TerritoryId == territoryId).ToListAsync();
                _byTerritory[territoryId] = list;
            }
            return list;
        }

        private Category Add(int territoryId, string name, StatColumn column)
        {
            var list = _byTerritory[territoryId];
            var category = new Category
            {
                TerritoryId = territoryId,
                Name = name.Length > CatalogRules.MaxCategoryNameLength ? name[..CatalogRules.MaxCategoryNameLength].Trim() : name,
                StatColumn = column,
                SortOrder = list.Count == 0 ? 1 : list.Max(c => c.SortOrder) + 1,
            };
            db.Categories.Add(category);
            list.Add(category);
            Added.Add(category.Name);
            return category;
        }

        /// <summary>
        /// The stat-sheet column an old category name stands for ("Mattress", "AdjustableBase"),
        /// as catalog files and the sample catalog named them before categories had names.
        /// </summary>
        private static StatColumn? OldColumnName(string name) =>
            name.Length > 0 && !char.IsDigit(name[0]) && !name.Contains(' ')
            && Enum.TryParse<StatColumn>(name, true, out var column) && Enum.IsDefined(column)
                ? column
                : null;

        #endregion
    }
}
