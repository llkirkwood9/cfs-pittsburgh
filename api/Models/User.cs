using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// A crew member who signs in with a username and password. Accounts are created by an
    /// system admin, administrator or territory manager; there is no self-service signup.
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
        /// Login handle typed on the sign-in screen
        /// </summary>
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        /// <summary>
        /// Optional email for the record
        /// </summary>
        [MaxLength(200)]
        public string? Email { get; set; }

        /// <summary>
        /// The password hash (ASP.NET Core Identity's PBKDF2 format). Null for an account that
        /// still only has a PIN from before passwords.
        /// </summary>
        [MaxLength(300)]
        public string? PasswordHash { get; set; }

        /// <summary>
        /// The user must choose a new password before doing anything else - after an
        /// administrator set it for them, or when they signed in with an old PIN.
        /// </summary>
        public bool MustChangePassword { get; set; }

        /// <summary>
        /// When the password was last set (UTC). Sessions opened before then are ended.
        /// </summary>
        public DateTime? PasswordChangedAt { get; set; }

        /// <summary>
        /// Wrong passwords in a row; reset by a successful sign-in
        /// </summary>
        public int FailedLoginCount { get; set; }

        /// <summary>
        /// Signing in is refused until this time (UTC) after too many wrong passwords
        /// </summary>
        public DateTime? LockoutUntil { get; set; }

        /// <summary>
        /// Salted hash of the PIN used before passwords. Kept only so an existing account can sign
        /// in once and choose a password; cleared as soon as it does.
        /// </summary>
        [MaxLength(200)]
        public string PinHash { get; set; } = string.Empty;

        /// <summary>
        /// Per-user salt for the old PIN hash
        /// </summary>
        [MaxLength(200)]
        public string PinSalt { get; set; } = string.Empty;

        /// <summary>
        /// Which parts of the app the user may reach
        /// </summary>
        public UserRole Role { get; set; } = UserRole.Sales;

        /// <summary>
        /// The territories a manager or crew member works in - one or several. Empty for system admins
        /// and administrators, who work across every territory.
        /// </summary>
        public List<UserTerritory> Territories { get; set; } = new();

        /// <summary>
        /// Inactive users cannot sign in
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// When the user last signed in with their password (UTC). Null until their first sign-in.
        /// </summary>
        public DateTime? LastLoginAt { get; set; }

        /// <summary>
        /// When the account was created
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
