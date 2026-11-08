using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// A heading the catalog's products are listed under, e.g. "Mattresses". Every territory has
    /// its own list, which its managers name, add to and put in order; the order is the order of
    /// the tabs on the floor's product picker and the Catalog screen.
    /// </summary>
    public class Category : ISortedCatalogItem
    {
        /// <summary>
        /// Primary Key - ID of category
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Name shown on the tabs and as the inventory sheet's headings, unique within its territory
        /// </summary>
        [MaxLength(60)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// The stat-sheet column its items count in. Also decides whether a new product in it has a
        /// warranty unless told otherwise, and which items the receipt email treats as mattresses
        /// and adjustable bases.
        /// </summary>
        public StatColumn StatColumn { get; set; } = StatColumn.Misc;

        /// <summary>
        /// Position within its territory's list
        /// </summary>
        public int SortOrder { get; set; }

        /// <summary>
        /// The territory whose catalog it is in
        /// </summary>
        public int? TerritoryId { get; set; }

        /// <summary>
        /// Navigation to the territory
        /// </summary>
        public Territory? Territory { get; set; }

        /// <summary>
        /// The products listed under it
        /// </summary>
        public List<Product> Products { get; set; } = new();
    }
}
