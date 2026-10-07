namespace api.Models
{
    /// <summary>
    /// Join row making a delivery option available for a product, with an optional price override
    /// so the same service can cost a different amount on different mattresses.
    /// </summary>
    public class ProductDeliveryOption
    {
        /// <summary>
        /// Primary Key - ID of the join row
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// FK to the product
        /// </summary>
        public int ProductId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public Product? Product { get; set; }

        /// <summary>
        /// FK to the delivery option
        /// </summary>
        public int DeliveryOptionId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public DeliveryOption? DeliveryOption { get; set; }

        /// <summary>
        /// Overrides the delivery option price for this product when set
        /// </summary>
        public decimal? PriceOverride { get; set; }

        /// <summary>
        /// Preselects this option when the product is added to an order
        /// </summary>
        public bool IsDefault { get; set; }

        /// <summary>
        /// Whether this product has its own sale on this delivery option, instead of the option's
        /// own sale. An own sale of nothing means no sale for this product.
        /// </summary>
        public bool HasOwnSale { get; set; }

        /// <summary>
        /// This product's own sale on the delivery option, as a percent off
        /// </summary>
        public decimal? SaleDiscountPercent { get; set; }

        /// <summary>
        /// This product's own sale on the delivery option, as a fixed amount off, when there is no percent
        /// </summary>
        public decimal? SaleDiscountAmount { get; set; }
    }
}
