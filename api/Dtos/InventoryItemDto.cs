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
        /// Units that left with Take With sales at the requested event, net of any returns
        /// </summary>
        public int? SoldAtEvent { get; set; }

        /// <summary>
        /// What the shelf count at the requested event found, when one was taken
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
