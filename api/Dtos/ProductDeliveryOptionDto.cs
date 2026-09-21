namespace api.Dtos
{
    /// <summary>
    /// A delivery option as offered for one specific product, carrying the effective price after
    /// any per-product override.
    /// </summary>
    public class ProductDeliveryOptionDto
    {
        /// <summary>
        /// Primary Key - ID of the join row
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// FK to the product
        /// </summary>
        public int? ProductId { get; set; }

        /// <summary>
        /// FK to the delivery option
        /// </summary>
        public int? DeliveryOptionId { get; set; }

        /// <summary>
        /// Delivery option name, copied for display
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Price to charge for this option on this product
        /// </summary>
        public decimal? Price { get; set; }

        /// <summary>
        /// Per-product override, null when the catalog default applies
        /// </summary>
        public decimal? PriceOverride { get; set; }

        /// <summary>
        /// Whether the charge is taxable
        /// </summary>
        public bool? IsTaxable { get; set; }

        /// <summary>
        /// Whether choosing this option ticks the Take With box
        /// </summary>
        public bool? IsTakeWith { get; set; }

        /// <summary>
        /// Whether this option is preselected when the product is added
        /// </summary>
        public bool? IsDefault { get; set; }
    }
}
