namespace api.Dtos
{
    /// <summary>
    /// Units and revenue for one product on the dashboard breakdown.
    /// </summary>
    public class ProductTallyDto
    {
        /// <summary>
        /// Product description as printed on the line
        /// </summary>
        public string? Description { get; set; }

        /// <summary>
        /// Brand of the product
        /// </summary>
        public string? Brand { get; set; }

        /// <summary>
        /// Category of the product
        /// </summary>
        public string? Category { get; set; }

        /// <summary>
        /// Units sold
        /// </summary>
        public int? Quantity { get; set; }

        /// <summary>
        /// Revenue before tax
        /// </summary>
        public decimal? Revenue { get; set; }
    }
}
