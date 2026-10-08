namespace api.Dtos
{
    /// <summary>
    /// One row of the Payment Options box.
    /// </summary>
    public class OrderPaymentDto
    {
        /// <summary>
        /// Primary Key - ID of payment
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// Which box on the sheet this amount belongs in
        /// </summary>
        public string? Method { get; set; }

        /// <summary>
        /// Amount tendered under this method
        /// </summary>
        public decimal? Amount { get; set; }

        /// <summary>
        /// Check number, written beside the Check # box
        /// </summary>
        public string? CheckNumber { get; set; }

        /// <summary>
        /// Free-text reference. For a financing payment, the financing number.
        /// </summary>
        public string? Reference { get; set; }

        /// <summary>
        /// For a financing payment, which financing the customer chose
        /// </summary>
        public string? FinanceType { get; set; }
    }
}
