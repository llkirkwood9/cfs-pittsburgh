using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// A sales territory: its own crew, events, catalog, stock and settings. System Admins and
    /// administrators work across every territory; everyone else belongs to one or more.
    /// </summary>
    public class Territory
    {
        /// <summary>
        /// Primary Key
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Name shown in pickers and on reports, e.g. "Pittsburgh"
        /// </summary>
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// An inactive territory's crew cannot sign in, and it can't be picked for anything new.
        /// Its events, orders and stock stay on file.
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// When it was created (UTC)
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// A manager or crew member's membership of a territory. Someone who sells in two territories
    /// belongs to both, and switches between them in the menu bar.
    /// </summary>
    public class UserTerritory
    {
        /// <summary>
        /// The user
        /// </summary>
        public int UserId { get; set; }

        /// <summary>
        /// Navigation to the user
        /// </summary>
        public User? User { get; set; }

        /// <summary>
        /// One of their territories
        /// </summary>
        public int TerritoryId { get; set; }

        /// <summary>
        /// Navigation to the territory
        /// </summary>
        public Territory? Territory { get; set; }
    }

    /// <summary>
    /// How many of one size a territory's cart has on hand.
    /// </summary>
    public class InventoryStock
    {
        /// <summary>
        /// Primary Key
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// The territory holding the stock
        /// </summary>
        public int TerritoryId { get; set; }

        /// <summary>
        /// Navigation to the territory
        /// </summary>
        public Territory? Territory { get; set; }

        /// <summary>
        /// The size counted
        /// </summary>
        public int ProductVariantId { get; set; }

        /// <summary>
        /// Navigation to the size
        /// </summary>
        public ProductVariant? ProductVariant { get; set; }

        /// <summary>
        /// Which combination of counted choices, e.g. "5:12|6:31" (selection:choice, by selection
        /// id), for products whose selections count stock separately. Empty for the size itself.
        /// </summary>
        [MaxLength(200)]
        public string StockKey { get; set; } = string.Empty;

        /// <summary>
        /// Units on hand
        /// </summary>
        public int QuantityOnHand { get; set; }
    }

    /// <summary>
    /// One setting a territory has changed from the company-wide value. A setting with no row
    /// here follows the company-wide value (AppSettings), which in turn falls back to its default.
    /// </summary>
    public class TerritorySetting
    {
        /// <summary>
        /// Primary Key
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// The territory it applies to
        /// </summary>
        public int TerritoryId { get; set; }

        /// <summary>
        /// Navigation to the territory
        /// </summary>
        public Territory? Territory { get; set; }

        /// <summary>
        /// Which setting, as in AppSettingKeys
        /// </summary>
        [MaxLength(100)]
        public string Key { get; set; } = string.Empty;

        /// <summary>
        /// The territory's value
        /// </summary>
        public string Value { get; set; } = string.Empty;

        /// <summary>
        /// When it was last saved (UTC)
        /// </summary>
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Who last saved it
        /// </summary>
        [MaxLength(150)]
        public string? UpdatedBy { get; set; }
    }

    /// <summary>
    /// A signed-in device. The refresh token itself lives only in the device's httpOnly cookie;
    /// the database keeps a SHA-256 hash of it, so a leaked database can't be used to sign in.
    /// </summary>
    public class UserSession
    {
        /// <summary>
        /// Primary Key
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Whose session
        /// </summary>
        public int UserId { get; set; }

        /// <summary>
        /// Navigation to the user
        /// </summary>
        public User? User { get; set; }

        /// <summary>
        /// SHA-256 of the refresh token, hex
        /// </summary>
        [MaxLength(64)]
        public string TokenHash { get; set; } = string.Empty;

        /// <summary>
        /// When the session ends unless renewed (UTC)
        /// </summary>
        public DateTime ExpiresAt { get; set; }

        /// <summary>
        /// When it was opened (UTC)
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// When it was last renewed (UTC)
        /// </summary>
        public DateTime LastUsedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// The browser it was opened from, trimmed, to recognise devices
        /// </summary>
        [MaxLength(200)]
        public string? UserAgent { get; set; }
    }
}
