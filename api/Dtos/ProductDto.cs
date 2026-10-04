namespace api.Dtos
{
    /// <summary>
    /// Request and response shape for a catalog product and its child variants and
    /// delivery availability.
    /// </summary>
    public class ProductDto
    {
        /// <summary>
        /// Primary Key - ID of product
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// Model name as written in the Description column
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Manufacturer printed in the Brand column
        /// </summary>
        public string? Brand { get; set; }

        /// <summary>
        /// Category used for stat-sheet tallies, as the enum name
        /// </summary>
        public string? Category { get; set; }

        /// <summary>
        /// Optional sales notes shown to the rep
        /// </summary>
        public string? Notes { get; set; }

        /// <summary>
        /// A sale on every size, as a percent off
        /// </summary>
        public decimal? SaleDiscountPercent { get; set; }

        /// <summary>
        /// A sale on every size, as a fixed amount off each item
        /// </summary>
        public decimal? SaleDiscountAmount { get; set; }

        /// <summary>
        /// Selections the rep makes beyond size, such as Color
        /// </summary>
        public List<ProductOptionDto>? Options { get; set; }

        /// <summary>
        /// Ordering within its category on the product picker
        /// </summary>
        public int? SortOrder { get; set; }

        /// <summary>
        /// Whether the product is offered on the floor
        /// </summary>
        public bool? IsActive { get; set; }

        /// <summary>
        /// Whether on-hand stock is counted for this product
        /// </summary>
        public bool? TrackInventory { get; set; }

        /// <summary>
        /// Priced size/configuration rows
        /// </summary>
        public List<ProductVariantDto>? Variants { get; set; }

        /// <summary>
        /// Delivery and service options available for this product
        /// </summary>
        public List<ProductDeliveryOptionDto>? DeliveryOptions { get; set; }
    }
}
