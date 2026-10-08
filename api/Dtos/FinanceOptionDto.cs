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
        /// The territory it belongs to, or null for a global option
        /// </summary>
        public int? TerritoryId { get; set; }

        /// <summary>
        /// The territory's name, for display (null for a global option)
        /// </summary>
        public string? TerritoryName { get; set; }

        /// <summary>
        /// Whether the signed-in user may change it (returned, not saved)
        /// </summary>
        public bool? CanEdit { get; set; }

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
