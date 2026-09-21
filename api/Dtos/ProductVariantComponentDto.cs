namespace api.Dtos
{
    /// <summary>
    /// One item bundled with a variant. On write only ComponentVariantId and Quantity are read;
    /// the descriptive fields are filled in on read so the catalog screen can label the item.
    /// </summary>
    public class ProductVariantComponentDto
    {
        /// <summary>
        /// Primary Key - ID of the component row
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// FK to the variant that comes with the bundle
        /// </summary>
        public int? ComponentVariantId { get; set; }

        /// <summary>
        /// How many come with one bundle
        /// </summary>
        public int? Quantity { get; set; }

        /// <summary>
        /// FK to the component's product
        /// </summary>
        public int? ProductId { get; set; }

        /// <summary>
        /// Component product name, e.g. "IMC61 Adjustable Base"
        /// </summary>
        public string? ProductName { get; set; }

        /// <summary>
        /// Component brand
        /// </summary>
        public string? Brand { get; set; }

        /// <summary>
        /// Component category, as the enum name
        /// </summary>
        public string? Category { get; set; }

        /// <summary>
        /// Component size
        /// </summary>
        public string? Size { get; set; }

        /// <summary>
        /// Component configuration, when it has one
        /// </summary>
        public string? Configuration { get; set; }
    }
}
