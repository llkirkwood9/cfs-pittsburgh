namespace api.Dtos
{
    /// <summary>
    /// A sales territory.
    /// </summary>
    public class TerritoryDto
    {
        /// <summary>
        /// Primary Key
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// Name, e.g. "Pittsburgh"
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Whether its crew can sign in and it can be picked for new things
        /// </summary>
        public bool? IsActive { get; set; }

        /// <summary>
        /// Active crew accounts in it (returned, not saved)
        /// </summary>
        public int? UserCount { get; set; }

        /// <summary>
        /// Events in it (returned, not saved)
        /// </summary>
        public int? EventCount { get; set; }

        /// <summary>
        /// Its own catalog items (returned, not saved)
        /// </summary>
        public int? ProductCount { get; set; }

        /// <summary>
        /// The name of its active event, if one is running (returned, not saved)
        /// </summary>
        public string? ActiveEvent { get; set; }

        /// <summary>
        /// When it was created (UTC)
        /// </summary>
        public DateTime? CreatedAt { get; set; }
    }
}
