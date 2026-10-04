namespace api.Dtos
{
    /// <summary>
    /// The end-of-event shelf count: what was found for each size that was counted.
    /// </summary>
    public class InventoryCountDto
    {
        /// <summary>
        /// Event the count closes out
        /// </summary>
        public int? EventId { get; set; }

        /// <summary>
        /// "Start" for the count before the event opens, "End" (the default) for the closing count
        /// </summary>
        public string? Phase { get; set; }

        /// <summary>
        /// Optional note saved with every row, e.g. "Counted by Jamie"
        /// </summary>
        public string? Note { get; set; }

        /// <summary>
        /// One entry per counted size
        /// </summary>
        public List<InventoryCountLineDto>? Counts { get; set; }
    }

    /// <summary>
    /// One counted size.
    /// </summary>
    public class InventoryCountLineDto
    {
        /// <summary>
        /// ID of the variant (size)
        /// </summary>
        public int? ProductVariantId { get; set; }

        /// <summary>
        /// Which combination of counted choices; empty or null for stock kept per size
        /// </summary>
        public string? StockKey { get; set; }

        /// <summary>
        /// Units found on the shelf
        /// </summary>
        public int? Counted { get; set; }
    }
}
