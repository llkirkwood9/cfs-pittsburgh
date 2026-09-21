namespace api.Dtos.Authentication
{
    /// <summary>
    /// Crew account. The PIN is write-only: it is accepted on create and update but never
    /// returned.
    /// </summary>
    public class UserDto
    {
        /// <summary>
        /// Primary Key - ID of user
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// Display name, also the default CFS Rep Name on new orders
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Login handle typed on the sign-in screen
        /// </summary>
        public string? Username { get; set; }

        /// <summary>
        /// Optional email for the record
        /// </summary>
        public string? Email { get; set; }

        /// <summary>
        /// Sales, Checkout or Admin
        /// </summary>
        public string? Role { get; set; }

        /// <summary>
        /// Whether the account may sign in
        /// </summary>
        public bool? IsActive { get; set; }

        /// <summary>
        /// Numeric PIN, accepted on write only and never returned
        /// </summary>
        public string? Pin { get; set; }
    }
}
