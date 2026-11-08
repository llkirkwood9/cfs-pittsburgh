namespace api.Dtos
{
    /// <summary>
    /// A selection a product offers beyond size, such as Color.
    /// </summary>
    public class ProductOptionDto
    {
        /// <summary>
        /// Primary Key; null for a new one
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// What is being chosen, e.g. "Color"
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Order on the add-item screen
        /// </summary>
        public int? SortOrder { get; set; }

        /// <summary>
        /// Whether the rep must pick a choice
        /// </summary>
        public bool? IsRequired { get; set; }

        /// <summary>
        /// Whether stock is counted for each choice
        /// </summary>
        public bool? TracksStock { get; set; }

        /// <summary>
        /// Whether stock is actually counted per choice of this selection right now (returned, not
        /// saved): it tracks stock, the product tracks inventory and it has an active choice. A
        /// counted selection must be picked before stock can be shown.
        /// </summary>
        public bool? CountsStock { get; set; }

        /// <summary>
        /// The choices on offer
        /// </summary>
        public List<ProductOptionChoiceDto>? Choices { get; set; }
    }

    /// <summary>
    /// One choice for a selection, such as "Gray".
    /// </summary>
    public class ProductOptionChoiceDto
    {
        /// <summary>
        /// Primary Key; null for a new one
        /// </summary>
        public int? Id { get; set; }

        /// <summary>
        /// The choice, e.g. "Gray"
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Added to the size's price when chosen; null for no change
        /// </summary>
        public decimal? PriceAdjustment { get; set; }

        /// <summary>
        /// Order on the add-item screen
        /// </summary>
        public int? SortOrder { get; set; }

        /// <summary>
        /// Whether it is still offered
        /// </summary>
        public bool? IsActive { get; set; }
    }

    /// <summary>
    /// Units on hand of a size in one combination of counted choices.
    /// </summary>
    public class ChoiceStockDto
    {
        /// <summary>
        /// The combination, e.g. "5:12"
        /// </summary>
        public string? StockKey { get; set; }

        /// <summary>
        /// Its choices, e.g. "Gray"
        /// </summary>
        public string? Label { get; set; }

        /// <summary>
        /// The choice ids the combination is made of, one per counted selection - pick these and
        /// this is the stock in play
        /// </summary>
        public List<int>? ChoiceIds { get; set; }

        /// <summary>
        /// Units on hand
        /// </summary>
        public int? QuantityOnHand { get; set; }
    }

    /// <summary>
    /// A selection made for an item on an order. The dashboard sends the ids; the API returns
    /// the names and any price change too.
    /// </summary>
    public class LineChoiceDto
    {
        /// <summary>
        /// The selection
        /// </summary>
        public int? OptionId { get; set; }

        /// <summary>
        /// The choice
        /// </summary>
        public int? ChoiceId { get; set; }

        /// <summary>
        /// The selection's name, e.g. "Color"
        /// </summary>
        public string? Option { get; set; }

        /// <summary>
        /// The choice's name, e.g. "Gray"
        /// </summary>
        public string? Choice { get; set; }

        /// <summary>
        /// What the choice added to the price
        /// </summary>
        public decimal? PriceAdjustment { get; set; }
    }

    /// <summary>
    /// The selections for one item that comes inside a bundle, picked when the bundle is added.
    /// </summary>
    public class IncludedChoicesDto
    {
        /// <summary>
        /// The bundled size
        /// </summary>
        public int? ComponentVariantId { get; set; }

        /// <summary>
        /// Its selections
        /// </summary>
        public List<LineChoiceDto>? Choices { get; set; }
    }
}
