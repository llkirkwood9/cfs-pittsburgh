namespace api.Dtos
{
    /// <summary>
    /// One tracked size on the Inventory screen and the event inventory sheet.
    /// </summary>
    public class InventoryItemDto
    {
        /// <summary>
        /// ID of the variant (size) being counted
        /// </summary>
        public int? ProductVariantId { get; set; }

        /// <summary>
        /// ID of the product
        /// </summary>
        public int? ProductId { get; set; }

        /// <summary>
        /// Product name, e.g. "Frio Mattress Protector"
        /// </summary>
        public string? ProductName { get; set; }

        /// <summary>
        /// Brand
        /// </summary>
        public string? Brand { get; set; }

        /// <summary>
        /// Product category name
        /// </summary>
        public string? Category { get; set; }

        /// <summary>
        /// Size label, e.g. "Queen"
        /// </summary>
        public string? Size { get; set; }

        /// <summary>
        /// Configuration, when the size has one
        /// </summary>
        public string? Configuration { get; set; }

        /// <summary>
        /// Units on hand now
        /// </summary>
        public int? QuantityOnHand { get; set; }

        /// <summary>
        /// Which combination of counted choices this row is, e.g. "5:12"; empty for stock kept per size
        /// </summary>
        public string? StockKey { get; set; }

        /// <summary>
        /// The combination's choices, e.g. "Gray / Striped"; empty for stock kept per size
        /// </summary>
        public string? Choices { get; set; }

        /// <summary>
        /// Units that left with Take With sales at the requested event, net of any returns
        /// </summary>
        public int? SoldAtEvent { get; set; }

        /// <summary>
        /// What the start-of-event count at the requested event found, when one was taken
        /// </summary>
        public int? OpeningCountAtEvent { get; set; }

        /// <summary>
        /// When the start-of-event count was taken
        /// </summary>
        public DateTime? OpeningCountedAt { get; set; }

        /// <summary>
        /// Who took the start-of-event count
        /// </summary>
        public string? OpeningCountedBy { get; set; }

        /// <summary>
        /// When the end-of-event count was taken
        /// </summary>
        public DateTime? CountedAt { get; set; }

        /// <summary>
        /// Who took the end-of-event count
        /// </summary>
        public string? CountedBy { get; set; }

        /// <summary>
        /// What the end-of-event count at the requested event found, when one was taken
        /// </summary>
        public int? CountedAtEvent { get; set; }

        /// <summary>
        /// What the app expected on the shelf when that count was taken
        /// </summary>
        public int? ExpectedAtCount { get; set; }

        /// <summary>
        /// When the count last changed
        /// </summary>
        public DateTime? LastChangedAt { get; set; }
    }
}
