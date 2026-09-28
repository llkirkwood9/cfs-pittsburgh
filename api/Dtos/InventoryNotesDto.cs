namespace api.Dtos
{
    /// <summary>
    /// The notes printed on an event's Accessory Inventory Sheet.
    /// </summary>
    public class InventoryNotesDto
    {
        /// <summary>
        /// Event the notes belong to
        /// </summary>
        public int? EventId { get; set; }

        /// <summary>
        /// The notes; empty or null clears them
        /// </summary>
        public string? Notes { get; set; }
    }
}
