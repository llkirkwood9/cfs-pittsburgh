namespace api.Dtos
{
    /// <summary>
    /// A priced size/configuration row of a product.
    /// </summary>
    public class ProductVariantDto
    {
        /// <summary>
        /// Primary Key - ID of variant
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// FK to the owning product
        /// </summary>
        public int? ProductId { get; set; }

        /// <summary>
        /// Size printed in the Size column
        /// </summary>
        public string? Size { get; set; }

        /// <summary>
        /// What the price includes, e.g. "Mattress Only" or "IMC61 Adjustable"
        /// </summary>
        public string? Configuration { get; set; }

        /// <summary>
        /// Price, or null when the price card says "Inquire"
        /// </summary>
        public decimal? Price { get; set; }

        /// <summary>
        /// Ordering within the product
        /// </summary>
        public int? SortOrder { get; set; }

        /// <summary>
        /// Whether the variant is offered on the floor
        /// </summary>
        public bool? IsActive { get; set; }

        /// <summary>
        /// Units on hand. Read-only here; counts are changed through the inventory endpoints.
        /// </summary>
        public int? QuantityOnHand { get; set; }

        /// <summary>
        /// Whether this size is left out of the product's inventory
        /// </summary>
        public bool? ExcludeFromInventory { get; set; }

        /// <summary>
        /// Whether this size has its own sale rather than the product's
        /// </summary>
        public bool? HasOwnSale { get; set; }

        /// <summary>
        /// This size's own sale as a percent off
        /// </summary>
        public decimal? SaleDiscountPercent { get; set; }

        /// <summary>
        /// This size's own sale as a fixed amount off each item
        /// </summary>
        public decimal? SaleDiscountAmount { get; set; }

        /// <summary>
        /// Units on hand for each combination of counted choices, for products whose selections
        /// count stock
        /// </summary>
        public List<ChoiceStockDto>? Stocks { get; set; }

        /// <summary>
        /// Items that come with this variant at no extra charge. Null on write leaves the
        /// existing list alone; an empty list clears it.
        /// </summary>
        public List<ProductVariantComponentDto>? Components { get; set; }
    }
}
