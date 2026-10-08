namespace api.Dtos
{
    /// <summary>
    /// Request and response shape for a kind of financing offered at checkout.
    /// </summary>
    public class FinanceOptionDto
    {
        /// <summary>
        /// Primary Key - ID of finance option
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// Name shown at checkout and printed on the sales sheet
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Ordering on the checkout picker
        /// </summary>
        public int? SortOrder { get; set; }

        /// <summary>
        /// Whether the option is offered at checkout
        /// </summary>
        public bool? IsActive { get; set; }
    }
}
