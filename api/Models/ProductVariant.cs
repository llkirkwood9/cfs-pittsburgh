using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// One priced line of a product: a size, optionally combined with a foundation or base
    /// configuration. A mattress model typically has Mattress Only, Hi-Rise and adjustable base
    /// variants for each of Twin through King.
    /// </summary>
    public class ProductVariant
    {
        /// <summary>
        /// Primary Key - ID of variant
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// FK to the owning product
        /// </summary>
        public int ProductId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public Product? Product { get; set; }

        /// <summary>
        /// Size printed in the Size column, e.g. "Queen", "Twin XL", "Standard"
        /// </summary>
        [MaxLength(50)]
        public string Size { get; set; } = string.Empty;

        /// <summary>
        /// What the price includes, e.g. "Mattress Only", "Hi-Rise", "IMC61 Adjustable".
        /// Null for accessories where size alone identifies the price.
        /// </summary>
        [MaxLength(100)]
        public string? Configuration { get; set; }

        /// <summary>
        /// Price for this size/configuration. Null means the price card says "Inquire" and the
        /// rep must key a price in by hand.
        /// </summary>
        public decimal? Price { get; set; }

        /// <summary>
        /// Ordering within the product
        /// </summary>
        public int SortOrder { get; set; }

        /// <summary>
        /// Inactive variants are hidden from the floor but retained on past orders
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Units of this size on hand at the cart. Only meaningful when the product tracks
        /// inventory; Take With sales draw it down when the order is completed.
        /// </summary>
        public int QuantityOnHand { get; set; }

        /// <summary>
        /// Whether this size has its own sale rather than the product's. With its own sale and no
        /// discount set, this size is left out of the product's sale.
        /// </summary>
        public bool HasOwnSale { get; set; }

        /// <summary>
        /// This size's own sale as a percent off, when HasOwnSale is set
        /// </summary>
        public decimal? SaleDiscountPercent { get; set; }

        /// <summary>
        /// This size's own sale as a fixed amount off each item, when HasOwnSale is set and there
        /// is no percent
        /// </summary>
        public decimal? SaleDiscountAmount { get; set; }

        /// <summary>
        /// Units on hand for each combination of counted choices, for products whose selections
        /// count stock separately
        /// </summary>
        public List<ChoiceStock> ChoiceStocks { get; set; } = new();

        /// <summary>
        /// Other catalog items that come with this one at no extra charge, e.g. the adjustable
        /// base in a mattress-and-base set. Empty for anything sold on its own.
        /// </summary>
        public List<ProductVariantComponent> Components { get; set; } = new();
    }
}
