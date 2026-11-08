import type {
    DashboardStats,
    EventTally,
    ProductTally,
    SaleMoment,
} from "../Models/DashboardStats";
import type { ProductCategory } from "../Models/Product";
import type { TerritoryStats } from "../Models/Territory";
import { CategoryNames } from "./Catalog";
import { DateKey, IsPastEvent, IsUpcomingEvent } from "./Events";
import { FormatCurrency, ParseServerTime } from "./Format";

/** How often the dashboard's figures refresh while it is open. */
export const DASHBOARD_POLL_MS = 15000;

/** Past this many stars, the rest are shown as a number so the card never overflows. */
const MAX_STARS_DRAWN = 8;

/**
 * How many stars a net sales figure has earned: one at the first milestone (normally $30,000),
 * and another for every step after that (normally $10,000). Both are set under Settings.
 * @param net Net sales.
 * @param firstAt Net sales that earn the first star.
 * @param every Net sales between each star after the first.
 * @returns The number of stars.
 */
const StarsFor = (net: number, firstAt: number, every: number): number =>
    every > 0 && net >= firstAt ? Math.floor((net - firstAt) / every) + 1 : 0;

/**
 * The milestone stars for the Net sales tile.
 * @param net Net sales.
 * @param firstAt Net sales that earn the first star.
 * @param every Net sales between each star after the first.
 * @returns Null until the first star is earned; otherwise how many to draw, how many more to show
 * as a number, and a label saying which milestone was passed and where the next one is.
 */
export const SalesStarsOf = (
    net: number,
    firstAt: number,
    every: number
): { drawn: number; extra: number; label: string } | null => {
    const stars = StarsFor(net, firstAt, every);
    if (stars === 0) return null;
    const passed = firstAt + (stars - 1) * every;
    return {
        drawn: Math.min(stars, MAX_STARS_DRAWN),
        extra: Math.max(0, stars - MAX_STARS_DRAWN),
        label: `${stars} star${stars === 1 ? "" : "s"}: net sales passed ${FormatCurrency(passed)}. Next star at ${FormatCurrency(passed + every)}.`,
    };
};

/** How many best sellers an event lists; the overview of every event lists every item sold. */
export const BEST_SELLERS = 15;

/** How many worst sellers the overview of every event lists. */
export const WORST_SELLERS = 20;

/** What the dashboard shows: one event's stat sheet, or every event side by side. */
export type DashboardScope = "event" | "all";

/**
 * The dashboard's heading.
 * @param scope What it shows.
 * @param viewingAll Whether every territory is in view.
 * @param territoryName The territory in view.
 * @param stats The figures shown.
 * @returns The heading.
 */
export const DashboardTitle = (
    scope: DashboardScope,
    viewingAll: boolean,
    territoryName: string,
    stats: DashboardStats | null
): string | null | undefined =>
    scope === "all"
        ? viewingAll
            ? "All events in every territory"
            : `All ${territoryName ? `${territoryName} ` : ""}events`
        : stats?.organization;

/**
 * The Units sold tiles.
 * @param stats The figures.
 * @returns Each tile's label, count and icon.
 */
export const UnitsSold = (
    stats: DashboardStats | null
): { label: string; value: number; icon: string }[] => [
    { label: "Mattresses", value: stats?.mattressCount ?? 0, icon: "fa-solid fa-bed" },
    {
        label: "Adjustable bases",
        value: stats?.adjustableBaseCount ?? 0,
        icon: "fa-solid fa-sliders",
    },
    { label: "Purple", value: stats?.purpleCount ?? 0, icon: "fa-solid fa-star" },
    { label: "Helix", value: stats?.helixCount ?? 0, icon: "fa-solid fa-star" },
    {
        label: "Protectors",
        value: stats?.mattressProtectorCount ?? 0,
        icon: "fa-solid fa-shield",
    },
    { label: "Pillows", value: stats?.pillowCount ?? 0, icon: "fa-solid fa-cloud" },
    { label: "Sheets", value: stats?.sheetCount ?? 0, icon: "fa-solid fa-layer-group" },
    { label: "Frames", value: stats?.frameCount ?? 0, icon: "fa-solid fa-border-all" },
    { label: "Bean bags", value: stats?.beanBagChairCount ?? 0, icon: "fa-solid fa-couch" },
    { label: "Other", value: stats?.miscCount ?? 0, icon: "fa-solid fa-box" },
];

/**
 * The Taken by rows: what came in by each way of paying.
 * @param stats The figures.
 * @returns Each row's label and amount.
 */
export const TakenBy = (stats: DashboardStats | null): { label: string; value: number }[] => [
    { label: "Credit/debit cards", value: stats?.creditCardTotal ?? 0 },
    { label: "Cash", value: stats?.cashTotal ?? 0 },
    { label: "Checks", value: stats?.checkTotal ?? 0 },
    { label: "Financing balance", value: stats?.financingTotal ?? 0 },
    { label: "Layaway balance", value: stats?.layawayTotal ?? 0 },
];

/** The category filter's choices on a best or worst sellers list. */
export const RankingCategoryOptions: { value: ProductCategory | "All"; label: string }[] = [
    { value: "All", label: "All categories" },
    ...(Object.keys(CategoryNames) as ProductCategory[]).map((c) => ({
        value: c,
        label: CategoryNames[c],
    })),
];

/**
 * A best or worst sellers list, narrowed to one category if picked and cut to the first few.
 * @param products The products, in rank order.
 * @param category The category picked, or "All".
 * @param limit How many to show; leave out to show them all.
 * @returns The products to show.
 */
export const RankProducts = (
    products: ProductTally[],
    category: ProductCategory | "All",
    limit?: number
): ProductTally[] =>
    products.filter((p) => category === "All" || p.category === category).slice(0, limit);

/**
 * What a best or worst sellers list says when it has nothing to show.
 * @param category The category picked, or "All".
 * @param empty What to say with every category picked.
 * @returns The line.
 */
export const RankingEmptyText = (category: ProductCategory | "All", empty: string): string =>
    category === "All" ? empty : `No ${CategoryNames[category].toLowerCase()} yet.`;

/** One bar of the sales-by-hour chart. */
export type SalesBucket = {
    key: string;
    label: string;
    long: string;
    total: number;
    count: number;
};

const hourLabel = (hour: number) => {
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h}${hour < 12 ? "a" : "p"}`;
};

const hourLong = (hour: number) => {
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h} ${hour < 12 ? "AM" : "PM"}`;
};

/**
 * Groups completed sales into bars: by hour of the day when they all fall on one day (the usual
 * event), otherwise by day. Every hour between the first and last sale gets a bar, so a quiet
 * hour shows as a gap rather than disappearing.
 * @param sales Completed sales.
 * @returns The bars, in order, and whether they are days.
 */
const BucketSales = (sales: SaleMoment[]): { buckets: SalesBucket[]; byDay: boolean } => {
    const points = sales
        .map((s) => ({ at: ParseServerTime(s.at), total: s.total ?? 0 }))
        .filter((p): p is { at: Date; total: number } => p.at !== null);

    if (points.length === 0) return { buckets: [], byDay: false };

    const days = new Set(points.map((p) => DateKey(p.at)));
    if (days.size > 1) {
        const map = new Map<string, SalesBucket>();
        for (const p of points) {
            const key = DateKey(p.at);
            const label = `${p.at.getMonth() + 1}/${p.at.getDate()}`;
            const bucket = map.get(key) ?? { key, label, long: label, total: 0, count: 0 };
            bucket.total += p.total;
            bucket.count += 1;
            map.set(key, bucket);
        }
        return {
            buckets: [...map.values()].sort((a, b) => a.key.localeCompare(b.key)),
            byDay: true,
        };
    }

    const hours = points.map((p) => p.at.getHours());
    const first = Math.min(...hours);
    const last = Math.max(...hours);
    const buckets: SalesBucket[] = [];
    for (let hour = first; hour <= last; hour++) {
        const inHour = points.filter((p) => p.at.getHours() === hour);
        buckets.push({
            key: String(hour),
            label: hourLabel(hour),
            long: `${hourLong(hour)} - ${hourLong((hour + 1) % 24)}`,
            total: inHour.reduce((sum, p) => sum + p.total, 0),
            count: inHour.length,
        });
    }
    return { buckets, byDay: false };
};

/** One bar of the sales chart. */
export type SalesBar = SalesBucket & {
    /** Its height, in the units the plot is drawn in. */
    height: number;
    /** Crowded bars label only every second or third one, so the text never collides. */
    showLabel: boolean;
};

/**
 * The sales chart: the bars, scaled to the plot, and the busiest one.
 * @param sales Completed sales.
 * @param plotHeight The plot's height, not counting the labels underneath.
 * @returns The bars, whether they are days, the largest total, and the busiest bar (null when
 * nothing has sold).
 */
export const SalesChart = (
    sales: SaleMoment[],
    plotHeight: number
): { bars: SalesBar[]; byDay: boolean; max: number; busiest: SalesBucket | null } => {
    const { buckets, byDay } = BucketSales(sales);
    const max = Math.max(0, ...buckets.map((b) => b.total));
    const busiest = buckets.reduce<SalesBucket | null>(
        (best, b) => (!best || b.total > best.total ? b : best),
        null
    );
    const labelEvery = buckets.length > 14 ? 3 : buckets.length > 8 ? 2 : 1;
    const bars = buckets.map((b, i) => ({
        ...b,
        // A bar with any sales is always tall enough to see.
        height: max > 0 ? Math.max(b.total > 0 ? 3 : 0, (b.total / max) * plotHeight) : 0,
        showLabel: i % labelEvery === 0,
    }));
    return { bars, byDay, max, busiest: busiest && busiest.total > 0 ? busiest : null };
};

/** The date ranges the territory comparison offers. */
export type ComparisonRange = "today" | "week" | "month" | "year" | "all";

export const ComparisonRanges: { key: ComparisonRange; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "7 days" },
    { key: "month", label: "30 days" },
    { key: "year", label: "This year" },
    { key: "all", label: "All time" },
];

/**
 * A comparison range's first and last days, in the viewer's own time zone.
 * @param range The range.
 * @returns The dates as YYYY-MM-DD; neither for all time.
 */
export const RangeDates = (range: ComparisonRange): { from?: string; to?: string } => {
    const today = new Date();
    const back = (days: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() - days);
        return DateKey(d);
    };
    switch (range) {
        case "today":
            return { from: DateKey(today), to: DateKey(today) };
        case "week":
            return { from: back(6), to: DateKey(today) };
        case "month":
            return { from: back(29), to: DateKey(today) };
        case "year":
            return { from: `${today.getFullYear()}-01-01`, to: DateKey(today) };
        default:
            return {};
    }
};

/**
 * The comparison's totals row, and the largest total for scaling the bars.
 * @param rows Each territory's figures.
 * @returns The totals and the top total (at least 1).
 */
export const ComparisonTotals = (rows: TerritoryStats[]) => ({
    top: Math.max(1, ...rows.map((r) => r.totalSales ?? 0)),
    totals: rows.reduce(
        (sum, r) => ({
            orders: sum.orders + (r.completedOrderCount ?? 0),
            total: sum.total + (r.totalSales ?? 0),
            net: sum.net + (r.netSales ?? 0),
            mattresses: sum.mattresses + (r.mattressCount ?? 0),
            bases: sum.bases + (r.adjustableBaseCount ?? 0),
        }),
        { orders: 0, total: 0, net: 0, mattresses: 0, bases: 0 }
    ),
});

/** One event's row on the overview's breakdown. */
export type EventBreakdownRow = {
    event: EventTally;
    total: number;
    /** Over and done with, rather than running now. */
    past: boolean;
    /** Its bar's length: its total against the best event's, as a percentage. */
    barPercent: number;
};

/**
 * Every event side by side, for the overview. Events that haven't happened yet are left out,
 * since they have no sales.
 * @param events Each event's figures.
 * @returns The rows, in the order given.
 */
export const EventBreakdownRows = (events: EventTally[]): EventBreakdownRow[] => {
    // The parts of an event the Past and upcoming checks read.
    const asEvent = (tally: EventTally) => ({
        isActive: tally.isActive,
        eventDate: tally.eventDate ?? undefined,
    });
    const shown = events.filter((e) => !IsUpcomingEvent(asEvent(e)));
    const best = Math.max(0, ...shown.map((e) => e.totalSales ?? 0));
    return shown.map((event) => {
        const total = event.totalSales ?? 0;
        return {
            event,
            total,
            past: IsPastEvent(asEvent(event)),
            barPercent: best > 0 ? (total / best) * 100 : 0,
        };
    });
};
