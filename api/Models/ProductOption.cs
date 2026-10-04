using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// A choice the rep makes for a product beyond its size, such as a sheet set's Color. Any
    /// product can have as many as it needs, each with its own list of choices.
    /// </summary>
    public class ProductOption
    {
        /// <summary>
        /// Primary Key
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// The product it belongs to
        /// </summary>
        public int ProductId { get; set; }

        /// <summary>
        /// Navigation to the product
        /// </summary>
        public Product? Product { get; set; }

        /// <summary>
        /// What is being chosen, e.g. "Color"
        /// </summary>
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Order on the add-item screen
        /// </summary>
        public int SortOrder { get; set; }

        /// <summary>
        /// Whether the rep must pick a choice before the item can be added. A selection whose
        /// stock is counted is always required.
        /// </summary>
        public bool IsRequired { get; set; } = true;

        /// <summary>
        /// Whether stock is counted separately for each choice - and for each combination with
        /// the product's other counted selections - rather than per size only. Only matters when
        /// the product tracks inventory.
        /// </summary>
        public bool TracksStock { get; set; }

        /// <summary>
        /// The choices on offer
        /// </summary>
        public List<ProductOptionChoice> Choices { get; set; } = new();
    }

    /// <summary>
    /// One choice for a selection, such as "Gray" for Color.
    /// </summary>
    public class ProductOptionChoice
    {
        /// <summary>
        /// Primary Key
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// The selection it belongs to
        /// </summary>
        public int ProductOptionId { get; set; }

        /// <summary>
        /// Navigation to the selection
        /// </summary>
        public ProductOption? ProductOption { get; set; }

        /// <summary>
        /// The choice, e.g. "Gray"
        /// </summary>
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Added to (or, when negative, taken off) the size's price when this is chosen; null
        /// for no change
        /// </summary>
        public decimal? PriceAdjustment { get; set; }

        /// <summary>
        /// Order on the add-item screen
        /// </summary>
        public int SortOrder { get; set; }

        /// <summary>
        /// Retired choices are kept, so stock and past sales still name them, but aren't offered
        /// </summary>
        public bool IsActive { get; set; } = true;
    }

    /// <summary>
    /// Units on hand of one size in one combination of counted choices, e.g. Queen in Gray. A
    /// size's stock with no counted selections stays on the size itself.
    /// </summary>
    public class ChoiceStock
    {
        /// <summary>
        /// Primary Key
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// The size
        /// </summary>
        public int ProductVariantId { get; set; }

        /// <summary>
        /// Navigation to the size
        /// </summary>
        public ProductVariant? ProductVariant { get; set; }

        /// <summary>
        /// Which combination of choices, e.g. "5:12|6:31" (selection:choice, by selection id)
        /// </summary>
        [MaxLength(200)]
        public string StockKey { get; set; } = string.Empty;

        /// <summary>
        /// Units on hand
        /// </summary>
        public int QuantityOnHand { get; set; }
    }
}
