namespace api.Models
{
    /// <summary>
    /// One item included in a bundle. A mattress sold as a set with an adjustable base is a variant
    /// (e.g. Agility 3000, Queen, IMC61 Adjustable) whose components include the base variant
    /// (IMC61 Adjustable Base, Queen). Each component prints as its own no-charge row under the
    /// bundle and counts in its own column on the stat sheet.
    /// </summary>
    public class ProductVariantComponent
    {
        /// <summary>
        /// Primary Key - ID of the component row
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// FK to the variant being sold as a bundle
        /// </summary>
        public int BundleVariantId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public ProductVariant? BundleVariant { get; set; }

        /// <summary>
        /// FK to the variant that comes with it
        /// </summary>
        public int ComponentVariantId { get; set; }

        /// <summary>
        /// Navigation property
        /// </summary>
        public ProductVariant? ComponentVariant { get; set; }

        /// <summary>
        /// How many of the component come with one bundle, e.g. 2 pillows with a mattress
        /// </summary>
        public int Quantity { get; set; } = 1;
    }
}
