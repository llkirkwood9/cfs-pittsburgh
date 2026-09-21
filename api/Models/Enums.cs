namespace api.Models
{
    /// <summary>
    /// High level product grouping. Drives the stat-sheet tallies on the dashboard.
    /// </summary>
    public enum ProductCategory
    {
        /// <summary>Sleep sets / mattresses of any brand, including Purple and Helix.</summary>
        Mattress = 0,

        /// <summary>Powered adjustable bases (IMC61, ES200 Flex Head, etc).</summary>
        AdjustableBase = 1,

        /// <summary>Pillows.</summary>
        Pillow = 2,

        /// <summary>Sheet sets.</summary>
        Sheets = 3,

        /// <summary>Mattress protectors.</summary>
        MattressProtector = 4,

        /// <summary>Bed frames.</summary>
        Frame = 5,

        /// <summary>Bean bag chairs.</summary>
        BeanBagChair = 6,

        /// <summary>Anything that does not belong to one of the tallied categories.</summary>
        Misc = 7,
    }

    /// <summary>
    /// Lifecycle of a single customer order as it moves from the sales floor to the checkout table.
    /// </summary>
    public enum OrderStatus
    {
        /// <summary>Being built by a sales rep on the floor. Multiple drafts may be open at once.</summary>
        Draft = 0,

        /// <summary>Sales rep pressed Complete. Sitting in the checkout team's queue.</summary>
        AwaitingCheckout = 1,

        /// <summary>Checkout team finished payment and printed the receipt.</summary>
        Completed = 2,

        /// <summary>Cancelled. Retained for the audit trail but excluded from all totals.</summary>
        Voided = 3,
    }

    /// <summary>
    /// The payment buckets printed in the Payment Options box on the sales sheet.
    /// </summary>
    public enum PaymentMethod
    {
        /// <summary>Credit card.</summary>
        VisaMc = 0,

        /// <summary>Cash.</summary>
        Cash = 1,

        /// <summary>Paper check. Carries a check number.</summary>
        Check = 2,

        /// <summary>Third party financing balance.</summary>
        Financing = 3,

        /// <summary>Layaway balance.</summary>
        Layaway = 4,
    }

    /// <summary>
    /// What a given line on the sales sheet represents.
    /// </summary>
    public enum OrderLineType
    {
        /// <summary>A catalog product variant.</summary>
        Product = 0,

        /// <summary>A delivery or in-home service charge attached to a product line.</summary>
        Delivery = 1,

        /// <summary>A free-text line typed by the rep for something not in the catalog.</summary>
        Custom = 2,
    }

    /// <summary>
    /// Determines which parts of the app a user may reach.
    /// </summary>
    public enum UserRole
    {
        /// <summary>Floor rep. Builds orders and hands them to checkout.</summary>
        Sales = 0,

        /// <summary>Checkout table. Takes payment, prints receipts.</summary>
        Checkout = 1,

        /// <summary>Full access including catalog and event administration.</summary>
        Admin = 2,
    }
}
