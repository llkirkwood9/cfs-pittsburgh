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
        /// Whether the price includes a powered adjustable base
        /// </summary>
        public bool? IncludesAdjustableBase { get; set; }

        /// <summary>
        /// Ordering within the product
        /// </summary>
        public int? SortOrder { get; set; }

        /// <summary>
        /// Whether the variant is offered on the floor
        /// </summary>
        public bool? IsActive { get; set; }
    }
}
