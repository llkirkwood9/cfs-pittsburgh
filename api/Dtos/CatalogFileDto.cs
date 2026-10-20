namespace api.Dtos
{
    /// <summary>
    /// The catalog as a file a system admin can download and restore: every product - global and every
    /// territory's - with its sizes, prices, sales, selections, bundles and delivery choices, plus
    /// the delivery options list. Territories are named, not numbered.
    /// Nothing refers to a database id - products are matched by brand and name, sizes by size
    /// and configuration, and delivery options, selections and choices by name - so a file from
    /// one installation can be restored into another.
    /// </summary>
    public class CatalogFileDto
    {
        /// <summary>
        /// Always "cfs-catalog", so a stray JSON file is turned away
        /// </summary>
        public string? Format { get; set; }

        /// <summary>
        /// Layout version of the file
        /// </summary>
        public int? Version { get; set; }

        /// <summary>
        /// When the file was made (UTC)
        /// </summary>
        public DateTime? ExportedAt { get; set; }

        /// <summary>
        /// The delivery options list
        /// </summary>
        public List<CatalogDeliveryOptionDto>? DeliveryOptions { get; set; }

        /// <summary>
        /// The products
        /// </summary>
        public List<CatalogProductDto>? Products { get; set; }

        /// <summary>
        /// The financing options checkout picks from, in their order. Left out of files made before
        /// they were exported, and a restore then leaves the current list alone.
        /// </summary>
        public List<CatalogFinanceOptionDto>? FinanceOptions { get; set; }
    }

    /// <summary>
    /// A financing option in a catalog file
    /// </summary>
    public class CatalogFinanceOptionDto
    {
        /// <summary>
        /// Name, e.g. "12 months no interest" - how the option is matched on restore
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Whether checkout offers it
        /// </summary>
        public bool? IsActive { get; set; }

        /// <summary>
        /// The territory it belongs to, by name; blank for a global one
        /// </summary>
        public string? Territory { get; set; }
    }

    /// <summary>
    /// A delivery option in a catalog file.
    /// </summary>
    public class CatalogDeliveryOptionDto
    {
        /// <summary>
        /// Name, e.g. "White Glove"
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Standard price
        /// </summary>
        public decimal? Price { get; set; }

        /// <summary>
        /// Whether sales tax applies
        /// </summary>
        public bool? IsTaxable { get; set; }

        /// <summary>
        /// Whether choosing it means the customer takes the item today
        /// </summary>
        public bool? IsTakeWith { get; set; }

        /// <summary>
        /// Whether its row prints on the sales sheet when it carries no charge
        /// </summary>
        public bool? ShowOnSalesSheet { get; set; }

        /// <summary>
        /// Whether it is offered
        /// </summary>
        public bool? IsActive { get; set; }

        /// <summary>
        /// The territory it belongs to, by name; blank for a global one
        /// </summary>
        public string? Territory { get; set; }

        /// <summary>
        /// A sale on the option, as a percent off
        /// </summary>
        public decimal? SaleDiscountPercent { get; set; }

        /// <summary>
        /// A sale on the option, as a fixed amount off, when there is no percent
        /// </summary>
        public decimal? SaleDiscountAmount { get; set; }
    }

    /// <summary>
    /// A product in a catalog file.
    /// </summary>
    public class CatalogProductDto
    {
        /// <summary>
        /// Model name
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// The territory it belongs to, by name; blank for a global one
        /// </summary>
        public string? Territory { get; set; }

        /// <summary>
        /// Brand
        /// </summary>
        public string? Brand { get; set; }

        /// <summary>
        /// Category, e.g. "Mattress"
        /// </summary>
        public string? Category { get; set; }

        /// <summary>
        /// Notes shown to the rep
        /// </summary>
        public string? Notes { get; set; }

        /// <summary>
        /// Position within its category
        /// </summary>
        public int? SortOrder { get; set; }

        /// <summary>
        /// Offered on the floor
        /// </summary>
        public bool? IsActive { get; set; }

        /// <summary>
        /// Whether stock is counted (the counts themselves are not in the file)
        /// </summary>
        public bool? TrackInventory { get; set; }

        /// <summary>
        /// Whether the product comes with a manufacturer warranty
        /// </summary>
        public bool? HasWarranty { get; set; }

        /// <summary>
        /// How long the warranty lasts, e.g. "10 years"
        /// </summary>
        public string? WarrantyLength { get; set; }

        /// <summary>
        /// Sale on every size, as a percent
        /// </summary>
        public decimal? SaleDiscountPercent { get; set; }

        /// <summary>
        /// Sale on every size, as an amount off each item
        /// </summary>
        public decimal? SaleDiscountAmount { get; set; }

        /// <summary>
        /// Sizes, in the order they are shown
        /// </summary>
        public List<CatalogVariantDto>? Variants { get; set; }

        /// <summary>
        /// Delivery options offered for this product
        /// </summary>
        public List<CatalogProductDeliveryDto>? DeliveryOptions { get; set; }

        /// <summary>
        /// Selections such as Color, in the order they are shown
        /// </summary>
        public List<CatalogOptionDto>? Options { get; set; }
    }

    /// <summary>
    /// A size in a catalog file.
    /// </summary>
    public class CatalogVariantDto
    {
        /// <summary>
        /// Size, e.g. "Queen"
        /// </summary>
        public string? Size { get; set; }

        /// <summary>
        /// Configuration, e.g. "Mattress Only"
        /// </summary>
        public string? Configuration { get; set; }

        /// <summary>
        /// Price; null means Inquire
        /// </summary>
        public decimal? Price { get; set; }

        /// <summary>
        /// Whether it is offered
        /// </summary>
        public bool? IsActive { get; set; }

        /// <summary>
        /// Whether the size is left out of a tracked product's inventory
        /// </summary>
        public bool? ExcludeFromInventory { get; set; }

        /// <summary>
        /// A note shown to the rep when this size is picked
        /// </summary>
        public string? Notes { get; set; }

        /// <summary>
        /// Whether the size has its own sale instead of the product's
        /// </summary>
        public bool? HasOwnSale { get; set; }

        /// <summary>
        /// The size's own sale, as a percent
        /// </summary>
        public decimal? SaleDiscountPercent { get; set; }

        /// <summary>
        /// The size's own sale, as an amount off each item
        /// </summary>
        public decimal? SaleDiscountAmount { get; set; }

        /// <summary>
        /// What comes with this size when it is sold as a bundle
        /// </summary>
        public List<CatalogComponentDto>? Includes { get; set; }
    }

    /// <summary>
    /// An item included with a size, named rather than numbered.
    /// </summary>
    public class CatalogComponentDto
    {
        /// <summary>
        /// The included product's brand
        /// </summary>
        public string? Brand { get; set; }

        /// <summary>
        /// The territory it belongs to, by name; blank for a global one
        /// </summary>
        public string? Territory { get; set; }

        /// <summary>
        /// The included product's name
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// The included size
        /// </summary>
        public string? Size { get; set; }

        /// <summary>
        /// The included size's configuration
        /// </summary>
        public string? Configuration { get; set; }

        /// <summary>
        /// How many come with each bundle
        /// </summary>
        public int? Quantity { get; set; }
    }

    /// <summary>
    /// A delivery option a product offers, by name.
    /// </summary>
    public class CatalogProductDeliveryDto
    {
        /// <summary>
        /// The delivery option's name
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// This product's own price for it, if different
        /// </summary>
        public decimal? PriceOverride { get; set; }

        /// <summary>
        /// Whether it is picked first
        /// </summary>
        public bool? IsDefault { get; set; }

        /// <summary>
        /// Whether this product has its own sale on the option instead of the option's
        /// </summary>
        public bool? HasOwnSale { get; set; }

        /// <summary>
        /// This product's own sale on the option, as a percent off
        /// </summary>
        public decimal? SaleDiscountPercent { get; set; }

        /// <summary>
        /// This product's own sale on the option, as a fixed amount off, when there is no percent
        /// </summary>
        public decimal? SaleDiscountAmount { get; set; }
    }

    /// <summary>
    /// A selection in a catalog file.
    /// </summary>
    public class CatalogOptionDto
    {
        /// <summary>
        /// Name, e.g. "Color"
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Whether a choice must be made
        /// </summary>
        public bool? IsRequired { get; set; }

        /// <summary>
        /// Whether stock is counted for each choice
        /// </summary>
        public bool? TracksStock { get; set; }

        /// <summary>
        /// The choices, in the order they are shown
        /// </summary>
        public List<CatalogChoiceDto>? Choices { get; set; }
    }

    /// <summary>
    /// A choice in a catalog file.
    /// </summary>
    public class CatalogChoiceDto
    {
        /// <summary>
        /// Name, e.g. "Gray"
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// What it adds to (or takes off) the price
        /// </summary>
        public decimal? PriceAdjustment { get; set; }
    }

    /// <summary>
    /// A request to restore a catalog file.
    /// </summary>
    public class CatalogImportDto
    {
        /// <summary>
        /// "update" to update matching items and add new ones, or "replace" to clear the catalog
        /// first
        /// </summary>
        public string? Mode { get; set; }

        /// <summary>
        /// The file's contents
        /// </summary>
        public CatalogFileDto? Catalog { get; set; }
    }

    /// <summary>
    /// What a restore did.
    /// </summary>
    public class CatalogImportResultDto
    {
        /// <summary>
        /// Products added
        /// </summary>
        public int ProductsAdded { get; set; }

        /// <summary>
        /// Existing products brought in line with the file
        /// </summary>
        public int ProductsUpdated { get; set; }

        /// <summary>
        /// Products deleted when the catalog was cleared
        /// </summary>
        public int ProductsRemoved { get; set; }

        /// <summary>
        /// Delivery options added
        /// </summary>
        public int DeliveryOptionsAdded { get; set; }

        /// <summary>
        /// Existing delivery options brought in line with the file
        /// </summary>
        public int DeliveryOptionsUpdated { get; set; }

        /// <summary>
        /// Delivery options deleted when the catalog was cleared
        /// </summary>
        public int DeliveryOptionsRemoved { get; set; }

        /// <summary>
        /// Financing options added
        /// </summary>
        public int FinanceOptionsAdded { get; set; }

        /// <summary>
        /// Financing options matched and updated
        /// </summary>
        public int FinanceOptionsUpdated { get; set; }

        /// <summary>
        /// Financing options deleted by a clear and replace
        /// </summary>
        public int FinanceOptionsRemoved { get; set; }

        /// <summary>
        /// Anything in the file that could not be brought in, e.g. a bundle naming an item that
        /// isn't in the catalog
        /// </summary>
        public List<string> Warnings { get; set; } = new();
    }
}
