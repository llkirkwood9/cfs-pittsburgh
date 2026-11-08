import type { InventoryItem } from "../Models/InventoryItem";
import { InventoryRowKey } from "./Inventory";

/** Which shelf count: before the doors open, or once the event is over. */
export type CountPhase = "start" | "end";

/**
 * The phase named in a route, defaulting to the end-of-event count.
 * @param value The route parameter.
 * @returns The phase.
 */
export const CountPhaseFrom = (value: string | undefined): CountPhase =>
    value === "start" ? "start" : "end";

/** The wording that differs between the two counts. */
export const CountPhaseCopy: Record<
    CountPhase,
    { title: string; intro: string; saved: string; notePlaceholder: string }
> = {
    start: {
        title: "Start-of-event count",
        intro: "Count what is on the shelf before the doors open.",
        saved: "Start-of-event count saved",
        notePlaceholder: "e.g. Counted by Jamie, 6 queen protectors delivered this morning",
    },
    end: {
        title: "End-of-event count",
        intro: "Count what is left on the shelf now that the event is over.",
        saved: "End-of-event count saved",
        notePlaceholder: "e.g. Counted by Jamie, one pillow kept as a floor sample",
    },
};

/**
 * Reads a typed count.
 * @param value What was typed.
 * @returns A whole number, 0 or more, or null when blank or not one.
 */
export const ParseCount = (value: string | undefined): number | null => {
    if (value === undefined || value.trim() === "") return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
};

/**
 * The counts a count already taken at this event opens with, so it can be corrected rather than
 * started again.
 * @param rows Inventory rows for the event.
 * @param phase Which count.
 * @returns Typed counts by row key.
 */
export const PreviousCounts = (
    rows: InventoryItem[],
    phase: CountPhase
): Record<string, string> => {
    const previous = (r: InventoryItem) =>
        phase === "start" ? r.openingCountAtEvent : r.countedAtEvent;
    return Object.fromEntries(
        rows
            .filter((r) => previous(r) !== null && previous(r) !== undefined)
            .map((r) => [InventoryRowKey(r), String(previous(r))])
    );
};

/** Where a count stands. */
export type CountProgress = {
    /** The sizes with a count entered. */
    entered: InventoryItem[];
    /** Whether anything typed isn't a whole number. */
    invalid: boolean;
    /** The counted sizes that differ from what the app expected. */
    differences: InventoryItem[];
    /** How many sizes are still blank. */
    blanks: number;
};

/**
 * Works out where a count stands.
 * @param items Inventory rows.
 * @param counts Typed counts by row key.
 * @returns The progress.
 */
export const CountProgressOf = (
    items: InventoryItem[],
    counts: Record<string, string>
): CountProgress => {
    const entered = items.filter((i) => ParseCount(counts[InventoryRowKey(i)]) !== null);
    return {
        entered,
        invalid: items.some((i) => {
            const raw = counts[InventoryRowKey(i)];
            return raw !== undefined && raw.trim() !== "" && ParseCount(raw) === null;
        }),
        differences: entered.filter(
            (i) => ParseCount(counts[InventoryRowKey(i)]) !== (i.quantityOnHand ?? 0)
        ),
        blanks: items.length - entered.length,
    };
};

/**
 * What saving a count asks before it goes ahead.
 * @param progress Where the count stands.
 * @param total How many sizes there are.
 * @param printsOnSheet Whether to mention the inventory sheet (only managers print it).
 * @returns The message.
 */
export const SaveCountMessage = (
    progress: CountProgress,
    total: number,
    printsOnSheet: boolean
): string =>
    `Save counts for ${progress.entered.length} of ${total} sizes?` +
    (progress.differences.length
        ? ` ${progress.differences.length} differ from what the app expected and will be updated to match the shelf.`
        : " Everything matches what the app expected.") +
    (printsOnSheet ? " The count prints on the event's Accessory Inventory Sheet." : "");
