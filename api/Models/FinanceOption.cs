using System.ComponentModel.DataAnnotations;

namespace api.Models
{
    /// <summary>
    /// A kind of financing a customer can choose at checkout, e.g. "12 months no interest". Kept in
    /// the catalog beside the delivery options. A financing payment stores the name it was recorded
    /// with, so renaming or removing an option never changes a past sale.
    /// </summary>
    public class FinanceOption
    {
        /// <summary>
        /// Primary Key - ID of finance option
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Name shown at checkout and printed in the sales sheet's comments
        /// </summary>
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Ordering on the checkout picker
        /// </summary>
        public int SortOrder { get; set; }

        /// <summary>
        /// Inactive options are kept in the catalog but not offered at checkout
        /// </summary>
        public bool IsActive { get; set; } = true;
    }
}
