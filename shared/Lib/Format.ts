const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

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
 * Reads a timestamp from the API. The server records moments such as "completed at" in UTC but
 * sends them without a zone marker, which a browser would otherwise take as local time - putting
 * every time off by the UTC offset. Plain dates (an event date) are not timestamps; format those
 * with FormatShortDate instead.
 * @param value ISO date string from the API.
 * @returns The moment, or null when there is no valid value.
 */
export const ParseServerTime = (value?: string | null): Date | null => {
    if (!value) return null;
    const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(value);
    const date = new Date(hasZone ? value : `${value}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Formats a server timestamp as a date and time in the viewer's time zone.
 * @param value ISO date string from the API.
 * @returns A string such as "9/21/26, 2:14 PM", or an empty string when there is no value.
 */
export const FormatDateTime = (value?: string | null): string => {
    const date = ParseServerTime(value);
    if (!date) return "";
    return date.toLocaleString("en-US", {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

/**
 * Formats the date part of a server timestamp in the viewer's time zone - for moments such as
 * when a sheet was signed, which would otherwise show the next day for an evening sale.
 * @param value ISO date string from the API.
 * @returns A string such as "9/21/26", or an empty string when there is no value.
 */
export const FormatStampDate = (value?: string | null): string => {
    const date = ParseServerTime(value);
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
    });
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
    return date.toLocaleDateString("en-US", {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
    });
};

/**
 * Formats a timestamp for the queue tiles.
 * @param value ISO date string.
 * @returns A string such as "2:14 PM", or an empty string when there is no value.
 */
export const FormatTime = (value?: string | null): string => {
    const date = ParseServerTime(value);
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });
};

/**
 * How long ago something happened, for the checkout queue.
 * @param value ISO date string.
 * @returns A string such as "4m ago".
 */
export const FormatElapsed = (value?: string | null): string => {
    const date = ParseServerTime(value);
    if (!date) return "";

    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ago`;
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
 * A rate as the percent people type, e.g. 0.07 as "7".
 * @param rate The rate.
 * @returns The percent, without trailing zeros.
 */
export const RateAsPercent = (rate: number): string => String(Number((rate * 100).toFixed(4)));

/**
 * A typed percent as a rate, e.g. "7" or "7 %" as 0.07.
 * @param percent What was typed.
 * @returns The rate, or NaN when it isn't a number.
 */
export const PercentAsRate = (percent: string): number =>
    Number(percent.replace(/[%\s]/g, "")) / 100;
