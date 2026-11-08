namespace api.Models
{
    /// <summary>
    /// A record that belongs to one territory, so only that territory's crew (and company-wide
    /// users) may see it. See TerritoryScoping for the filters built on it.
    /// </summary>
    public interface ITerritoryOwned
    {
        /// <summary>
        /// The owning territory, or null when it isn't known (a catalog item from before every
        /// territory had its own catalog, or an order loaded without its event).
        /// </summary>
        int? TerritoryId { get; }
    }

    /// <summary>
    /// A catalog list item a manager puts in order within its territory, such as a delivery
    /// option or a financing option.
    /// </summary>
    public interface ISortedCatalogItem : ITerritoryOwned
    {
        /// <summary>Primary key</summary>
        int Id { get; }

        /// <summary>Position within its territory's list</summary>
        int SortOrder { get; set; }
    }
}
