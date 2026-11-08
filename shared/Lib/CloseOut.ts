import type { InventoryItem } from "../Models/InventoryItem";
import type { OrderSummary } from "../Models/OrderSummary";
import { FormatCurrency, FormatTime } from "./Format";

/** Balances below this are rounding, not money owed. */
const OWED_TOLERANCE = 0.004;

/** Orders about to be discarded or voided, waiting for a yes. */
export type Clearing = {
    orders: OrderSummary[];
    title: string;
    message: string;
    confirmText: string;
};

const orderName = (o: OrderSummary) =>
    `order #${o.orderNumber}${o.billingName ? ` for ${o.billingName}` : ""}`;

/**
 * The question asked before discarding or voiding one open order.
 * @param o The order.
 * @returns What to confirm.
 */
export const ClearOne = (o: OrderSummary): Clearing =>
    // The server says which: a draft with nothing paid is deleted; anything that reached
    // checkout, or has a payment on it, is voided so the record of it stays.
    o.voidsWhenCleared
        ? {
              orders: [o],
              title: "Void order",
              message: `Void ${orderName(o)}? It's kept, marked Voided, and left out of the totals.`,
              confirmText: "Void",
          }
        : {
              orders: [o],
              title: "Discard order",
              message: `Discard ${orderName(o)}? It's deleted and can't be brought back.`,
              confirmText: "Discard",
          };

/**
 * The question asked before clearing a list of open orders in one step.
 * @param list The orders.
 * @param what What they are, e.g. "orders on the floor".
 * @returns What to confirm.
 */
export const ClearAll = (list: OrderSummary[], what: string): Clearing => {
    const voiding = list.filter((o) => o.voidsWhenCleared).length;
    const discarding = list.length - voiding;
    const parts = [
        discarding ? `${discarding} discarded (deleted for good)` : null,
        voiding ? `${voiding} voided (kept, but left out of the totals)` : null,
    ].filter(Boolean);
    return {
        orders: list,
        title: `Clear ${list.length} ${what}`,
        message: `Clear all ${list.length} ${what}? ${parts.join(" and ")}.`,
        confirmText: "Clear all",
    };
};

/** Where an event stands at close-out. */
export type CloseOutSummary = {
    /** Orders still being written up on the floor. */
    drafts: OrderSummary[];
    /** Orders waiting to be paid. */
    atCheckout: OrderSummary[];
    completed: OrderSummary[];
    /** Completed sales with a balance still owed. */
    owing: OrderSummary[];
    totalOwed: number;
    /** What the completed sales came to. */
    takings: number;
    /** When the start-of-event count was last taken, or null. */
    startAt: string | null;
    /** When the end-of-event count was last taken, or null. */
    endAt: string | null;
    /** Whether the event keeps inventory at all. */
    tracks: boolean;
};

/**
 * Works out where an event stands from its orders and stock.
 * @param orders The event's orders.
 * @param inventory The event's inventory rows.
 * @returns The summary.
 */
export const SummarizeCloseOut = (
    orders: OrderSummary[],
    inventory: InventoryItem[]
): CloseOutSummary => {
    const completed = orders.filter((o) => o.status === "Completed");
    const owing = completed.filter((o) => (o.balanceDue ?? 0) > OWED_TOLERANCE);
    const latest = (at: (i: InventoryItem) => string | null | undefined) =>
        (inventory.map(at).filter(Boolean) as string[]).sort().pop() ?? null;
    return {
        drafts: orders.filter((o) => o.status === "Draft"),
        atCheckout: orders.filter((o) => o.status === "AwaitingCheckout"),
        completed,
        owing,
        totalOwed: owing.reduce((sum, o) => sum + (o.balanceDue ?? 0), 0),
        takings: completed.reduce((sum, o) => sum + (o.total ?? 0), 0),
        startAt: latest((i) => i.openingCountedAt),
        endAt: latest((i) => i.countedAt),
        tracks: inventory.length > 0,
    };
};

/** One thing to check at close-out. */
export type CloseOutStep = {
    key: "floor" | "checkout" | "balances" | "start" | "end";
    title: string;
    done: boolean;
    /** A step that is fine to leave, such as a layaway balance, shows as information not a warning. */
    optional?: boolean;
    summary: string;
    /** The orders it lists. */
    orders?: OrderSummary[];
    /** Whether a manager can discard or void the listed orders. */
    clearable?: boolean;
    /** Clearing every listed order in one go, when there are several. */
    clearAll?: { what: string; text: "Clear all" | "Void all" };
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The close-out checklist.
 * @param summary Where the event stands.
 * @param active Whether the event is still running.
 * @returns The steps, in order.
 */
export const CloseOutSteps = (summary: CloseOutSummary, active: boolean): CloseOutStep[] => {
    const { drafts, atCheckout, owing, totalOwed, startAt, endAt } = summary;
    return [
        {
            key: "floor",
            title: "Nothing left on the sales floor",
            done: drafts.length === 0,
            summary:
                drafts.length === 0
                    ? "Every order has been sent to checkout or discarded."
                    : `${drafts.length} order${plural(drafts.length, " is", "s are")} still being written up. Send ${plural(
                          drafts.length,
                          "it",
                          "them"
                      )} to checkout, or discard ${plural(drafts.length, "it", "them")}.`,
            orders: drafts,
            clearable: true,
            clearAll: { what: "orders on the floor", text: "Clear all" },
        },
        {
            key: "checkout",
            title: "Nobody waiting at checkout",
            done: atCheckout.length === 0,
            summary:
                atCheckout.length === 0
                    ? "Every order that reached checkout has been completed or voided."
                    : `${atCheckout.length} order${plural(atCheckout.length, " is", "s are")} waiting to be paid. Complete or void ${plural(
                          atCheckout.length,
                          "it",
                          "them"
                      )}.`,
            orders: atCheckout,
            clearable: true,
            clearAll: { what: "orders at checkout", text: "Void all" },
        },
        {
            key: "balances",
            title: "Balances still owed",
            done: owing.length === 0,
            optional: true,
            summary:
                owing.length === 0
                    ? "Every completed sale is paid in full."
                    : `${owing.length} completed sale${plural(owing.length, "", "s")} still owe${plural(
                          owing.length,
                          "s",
                          ""
                      )} ${FormatCurrency(totalOwed)} - normal for layaway and financing.`,
            orders: owing,
        },
        ...(summary.tracks
            ? [
                  {
                      key: "start" as const,
                      title: "Start-of-event count",
                      done: Boolean(startAt),
                      optional: true,
                      summary: startAt
                          ? `Taken at ${FormatTime(startAt)}.`
                          : "Not taken. The inventory sheet will have no starting figures.",
                  },
                  {
                      key: "end" as const,
                      title: "End-of-event count",
                      done: Boolean(endAt),
                      summary: endAt
                          ? `Taken at ${FormatTime(endAt)}.`
                          : active
                            ? "Count what's left on the shelf before the event is closed."
                            : "Not taken. Counts can only be taken while the event is active.",
                  },
              ]
            : []),
    ];
};

/**
 * What the close-event confirmation says: the steps still to do, if any.
 * @param organization The event's organization.
 * @param blocking The steps not done that should be.
 * @returns The message.
 */
export const CloseEventMessage = (
    organization: string | undefined,
    blocking: CloseOutStep[]
): string =>
    blocking.length
        ? `There ${plural(blocking.length, "is", "are")} still ${blocking.length} thing${plural(
              blocking.length,
              "",
              "s"
          )} to do: ${blocking.map((b) => b.title.toLowerCase()).join("; ")}. Close the event anyway? Open orders stay open and can still be finished.`
        : `Close ${organization}? No new orders can be taken under it once it's closed.`;
