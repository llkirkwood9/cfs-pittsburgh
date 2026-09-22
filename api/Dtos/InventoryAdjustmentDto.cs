namespace api.Dtos
{
    /// <summary>
    /// Request and response shape for a change to an on-hand count. A request sends either
    /// Change (add or remove units) or SetTo (the counted total), not both.
    /// </summary>
    public class InventoryAdjustmentDto
    {
        /// <summary>
        /// Primary Key - ID of adjustment
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// ID of the variant (size) being counted
        /// </summary>
        public int? ProductVariantId { get; set; }

        /// <summary>
        /// Units added (positive) or removed (negative)
        /// </summary>
        public int? Change { get; set; }

        /// <summary>
        /// Request only: the counted total to set the size to
        /// </summary>
        public int? SetTo { get; set; }

        /// <summary>
        /// Response only: Adjustment, Sale or Return
        /// </summary>
        public string? Kind { get; set; }

        /// <summary>
        /// Response only: the on-hand count after the change
        /// </summary>
        public int? QuantityAfter { get; set; }

        /// <summary>
        /// Response only: order number for Sale and Return rows
        /// </summary>
        public int? OrderNumber { get; set; }

        /// <summary>
        /// Response only: who made the change
        /// </summary>
        public string? UserName { get; set; }

        /// <summary>
        /// Optional note, e.g. "Delivery from warehouse"
        /// </summary>
        public string? Note { get; set; }

        /// <summary>
        /// Response only: when the change was made
        /// </summary>
        public DateTime? CreatedAt { get; set; }
    }
}
