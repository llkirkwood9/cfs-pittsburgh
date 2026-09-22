import type { InventoryItem } from "../Models/InventoryItem";
import type { Order } from "../Models/Order";
import type { OrderLine } from "../Models/OrderLine";
import type { PaymentMethod } from "../Models/OrderPayment";
import type { ProductCategory } from "../Models/Product";
import type { ProductVariant } from "../Models/ProductVariant";

/**
 * What each payment method is called on screen and on the printed sheet. The stored value stays
 * VisaMc so older orders keep reading correctly.
 */
export const PaymentMethodLabels: Record<PaymentMethod, string> = {
    Cash: "Cash",
    Check: "Check",
    VisaMc: "Credit/Debit Card",
    Financing: "Financing",
    Layaway: "Layaway",
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/**
 * Formats a number as US currency, treating null and undefined as zero.
 * @param value Amount to format.
 * @returns A string such as "$2,249.10".
 */
export const FormatCurrency = (value?: number | null): string => currency.format(value ?? 0);

/**
 * Formats a rate stored as a fraction into a percentage label.
 * @param rate Rate as a fraction, e.g. 0.07.
 * @returns A string such as "7%".
 */
export const FormatRate = (rate?: number | null): string => {
    const percent = (rate ?? 0) * 100;
    return `${Number(percent.toFixed(4))}%`;
};

/**
 * Formats a date for the Sale Date cell and the receipt footer.
 * @param value ISO date string.
 * @returns A string such as "9/12/26", or an empty string when there is no date.
 */
export const FormatShortDate = (value?: string | null): string => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { year: "2-digit", month: "numeric", day: "numeric" });
};

/**
 * Formats a timestamp for the queue tiles.
 * @param value ISO date string.
 * @returns A string such as "2:14 PM", or an empty string when there is no value.
 */
export const FormatTime = (value?: string | null): string => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

/**
 * How long ago something happened, for the checkout queue.
 * @param value ISO date string.
 * @returns A string such as "4m ago".
 */
export const FormatElapsed = (value?: string | null): string => {
    if (!value) return "";
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return "";

    const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
};

/**
 * Builds the label shown on a variant chip, e.g. "Queen - IMC61 Adjustable".
 * @param variant The variant to label.
 * @returns The display label.
 */
export const VariantLabel = (variant: ProductVariant): string =>
    variant.configuration ? `${variant.size} - ${variant.configuration}` : (variant.size ?? "");

/**
 * Whether a variant has no price on file and needs one keyed in by hand.
 * @param variant The variant to test.
 * @returns True when the price card reads "Inquire".
 */
export const NeedsPrice = (variant: ProductVariant): boolean =>
    variant.price === null || variant.price === undefined;

/**
 * Whether a line prints on the sales sheet. Shipping rows whose option is set not to show (Take
 * With, by default) are left off - unless they carry a charge, which always prints so the
 * sheet's subtotal still adds up.
 * @param line The order line.
 * @returns True when the line belongs on the printed sheet.
 */
export const PrintsOnSalesSheet = (line: OrderLine): boolean =>
    line.lineType !== "Delivery" || line.showOnSalesSheet !== false || (line.lineTotal ?? 0) !== 0;

/**
 * Groups order lines so each delivery charge sits directly under the product it belongs to,
 * which is how the paper sheet reads.
 * @param lines The order's lines.
 * @returns Lines in print order.
 */
export const SortLinesForPrint = (lines: OrderLine[]): OrderLine[] => {
    const sorted = [...lines].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const children = new Map<number, OrderLine[]>();
    const roots: OrderLine[] = [];

    sorted.forEach((line) => {
        if (line.parentLineId) {
            const bucket = children.get(line.parentLineId) ?? [];
            bucket.push(line);
            children.set(line.parentLineId, bucket);
        } else {
            roots.push(line);
        }
    });

    const result: OrderLine[] = [];
    roots.forEach((root) => {
        result.push(root);
        (children.get(root.id ?? -1) ?? []).forEach((child) => result.push(child));
    });

    // Any orphan whose parent was removed still has to print rather than silently vanish.
    sorted.forEach((line) => {
        if (!result.includes(line)) result.push(line);
    });

    return result;
};

/**
 * Parses a price typed into a text field, tolerating "$" and thousands separators.
 * @param value The raw input value.
 * @returns The parsed number, or null when the field is blank or unparseable.
 */
export const ParseMoney = (value: string): number | null => {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (cleaned === "" || cleaned === "-") return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Whether the customer has confirmed their details, initialled all three paragraphs and signed -
 * everything the sales sheet needs before checkout can complete the sale.
 * @param order The order.
 * @returns True when every acknowledgement is in.
 */
export const IsAcknowledged = (order: Order): boolean =>
    Boolean(
        order.customerInfoInitials?.trim() &&
            order.warrantyInitials?.trim() &&
            order.dropShipInitials?.trim() &&
            order.advisoryInitials?.trim() &&
            order.customerSignature
    );

/**
 * One address as printed lines, e.g. ["211 Central Drive, Unit 4", "Butler, PA 16001"].
 * @param parts The address fields.
 * @returns The non-empty lines.
 */
export const AddressLines = (parts: {
    address?: string | null;
    unit?: string | null;
    floor?: string | null;
    suite?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
}): string[] => {
    const street = [
        parts.address,
        parts.unit && `Unit ${parts.unit}`,
        parts.floor && `Floor ${parts.floor}`,
        parts.suite && `Suite ${parts.suite}`,
    ]
        .filter(Boolean)
        .join(", ");
    const town = [parts.city, [parts.state, parts.zip].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
    return [street, town].filter(Boolean);
};

/** Full, plural category names for headings, e.g. on the inventory sheet. */
export const CategoryNames: Record<ProductCategory, string> = {
    Mattress: "Mattresses",
    AdjustableBase: "Adjustable Bases",
    Pillow: "Pillows",
    Sheets: "Sheets",
    MattressProtector: "Mattress Protectors",
    Frame: "Frames",
    BeanBagChair: "Bean Bag Chairs",
    Misc: "Other",
};

export type InventoryGroup = {
    category: ProductCategory;
    products: { productId: number; name: string; brand: string; sizes: InventoryItem[] }[];
};

/**
 * Groups inventory rows by category, then product, keeping the server's catalog order.
 * @param items Inventory rows.
 * @returns One group per category that has tracked items.
 */
export const GroupInventory = (items: InventoryItem[]): InventoryGroup[] => {
    const groups: InventoryGroup[] = [];

    for (const item of items) {
        const category = item.category ?? "Misc";
        let group = groups.find((g) => g.category === category);
        if (!group) {
            group = { category, products: [] };
            groups.push(group);
        }

        let product = group.products.find((p) => p.productId === item.productId);
        if (!product) {
            product = {
                productId: item.productId ?? 0,
                name: item.productName ?? "",
                brand: item.brand ?? "",
                sizes: [],
            };
            group.products.push(product);
        }

        product.sizes.push(item);
    }

    return groups;
};

/**
 * The size label for an inventory row, e.g. "Queen" or "Queen - Soft".
 * @param item The inventory row.
 * @returns The label.
 */
export const InventorySizeLabel = (item: InventoryItem): string =>
    [item.size, item.configuration].filter(Boolean).join(" - ") || "One size";

/**
 * Why a tracked item cannot go home as a Take With, or null when it can. Untracked items (a null
 * count) are always allowed.
 * @param onHand Units on hand, or null/undefined when the product is not tracked.
 * @param quantity Units the customer wants to take.
 * @returns A short reason such as "Out of stock" or "Only 2 in stock", or null.
 */
export const TakeWithBlocked = (onHand: number | null | undefined, quantity: number): string | null => {
    if (onHand === null || onHand === undefined) return null;
    if (onHand <= 0) return "Out of stock";
    return onHand < quantity ? `Only ${onHand} in stock` : null;
};
