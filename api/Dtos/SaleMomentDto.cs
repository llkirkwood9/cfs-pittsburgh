namespace api.Dtos
{
    /// <summary>
    /// One completed sale on the dashboard's timeline.
    /// </summary>
    public class SaleMomentDto
    {
        /// <summary>
        /// When the sale was completed (UTC)
        /// </summary>
        public DateTime? At { get; set; }

        /// <summary>
        /// The sale total, including tax and any card fee
        /// </summary>
        public decimal? Total { get; set; }
    }
}
