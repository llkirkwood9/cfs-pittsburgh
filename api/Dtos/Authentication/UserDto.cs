namespace api.Dtos.Authentication
{
    /// <summary>
    /// Crew account. The password is write-only: it is accepted when an account is created or
    /// reset, never returned.
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
        /// Sales, Checkout, SalesCheckout, Manager, Admin or Owner
        /// </summary>
        public string? Role { get; set; }

        /// <summary>
        /// The territory a manager or crew member works in; null for owners and administrators
        /// </summary>
        public int? TerritoryId { get; set; }

        /// <summary>
        /// The territory's name, for display
        /// </summary>
        public string? TerritoryName { get; set; }

        /// <summary>
        /// Whether the account may sign in
        /// </summary>
        public bool? IsActive { get; set; }

        /// <summary>
        /// A new password, accepted on write only and never returned. Set by an owner,
        /// administrator or manager, it must be changed at the next sign-in.
        /// </summary>
        public string? Password { get; set; }

        /// <summary>
        /// Whether the user has to choose a new password before carrying on
        /// </summary>
        public bool? MustChangePassword { get; set; }

        /// <summary>
        /// Whether the account is locked after too many wrong passwords (crew screen only)
        /// </summary>
        public bool? IsLockedOut { get; set; }

        /// <summary>
        /// When they last signed in (UTC). Only sent to an owner.
        /// </summary>
        public DateTime? LastLoginAt { get; set; }
    }
}
