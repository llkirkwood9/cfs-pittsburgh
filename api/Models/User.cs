using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// A crew member who signs in on a tablet. Accounts are pre-provisioned by an admin;
    /// there is no self-service signup.
    /// </summary>
    public class User
    {
        /// <summary>
        /// Primary Key - ID of user
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Display name, also used as the default CFS Rep Name on new orders
        /// </summary>
        [MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Short login handle typed on the sign-in screen
        /// </summary>
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        /// <summary>
        /// Optional email for the record
        /// </summary>
        [MaxLength(200)]
        public string? Email { get; set; }

        /// <summary>
        /// Salted hash of the numeric PIN
        /// </summary>
        [MaxLength(200)]
        public string PinHash { get; set; } = string.Empty;

        /// <summary>
        /// Per-user salt for the PIN hash
        /// </summary>
        [MaxLength(200)]
        public string PinSalt { get; set; } = string.Empty;

        /// <summary>
        /// Which parts of the app the user may reach
        /// </summary>
        public UserRole Role { get; set; } = UserRole.Sales;

        /// <summary>
        /// Inactive users cannot sign in
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Opaque refresh token issued at login
        /// </summary>
        [MaxLength(200)]
        public string? RefreshToken { get; set; }

        /// <summary>
        /// Expiry of the current refresh token
        /// </summary>
        public DateTime? RefreshTokenExpiry { get; set; }

        /// <summary>
        /// When the account was created
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
