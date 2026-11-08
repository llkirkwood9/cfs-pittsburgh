namespace api.Dtos
{
    /// <summary>
    /// Request and response shape for a catalog category.
    /// </summary>
    public class CategoryDto
    {
        /// <summary>
        /// Primary Key - ID of category
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// The territory whose catalog it is in
        /// </summary>
        public int? TerritoryId { get; set; }

        /// <summary>
        /// The territory's name, for display
        /// </summary>
        public string? TerritoryName { get; set; }

        /// <summary>
        /// Whether the signed-in user may change it (returned, not saved)
        /// </summary>
        public bool? CanEdit { get; set; }

        /// <summary>
        /// Name shown on the tabs
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// The stat-sheet column its items count in, as the enum name
        /// </summary>
        public string? StatColumn { get; set; }

        /// <summary>
        /// Position on the tabs
        /// </summary>
        public int? SortOrder { get; set; }

        /// <summary>
        /// How many products are listed under it, archived ones included (returned, not saved)
        /// </summary>
        public int? ProductCount { get; set; }
    }
}
