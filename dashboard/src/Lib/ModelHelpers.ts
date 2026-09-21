import type { OrderLine } from "../Models/OrderLine";
import type { ProductVariant } from "../Models/ProductVariant";

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
