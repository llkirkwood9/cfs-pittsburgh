import type { ReactNode } from "react";
import { FormatCurrency, FormatShortDate } from "../../Lib/ModelHelpers";
import type { DashboardStats } from "../../Models/DashboardStats";
import type { Event } from "../../Models/Event";
import type { Order } from "../../Models/Order";
import type { PaymentMethod } from "../../Models/OrderPayment";

type Props = {
    saleEvent: Event | null;
    stats: DashboardStats | null;
    orders: Order[];
};

type Entry = { key: string; label: string; amount: number };

/** Minimum ruled lines per itemised column, so a quiet event still looks like the paper form. */
const MIN_LIST_ROWS = 14;

const box = "border border-black";
const heading = "border-b border-black px-1 py-[2px] text-center text-[9px] font-bold uppercase";
const totalRow = "border-t border-black px-1 py-[2px] text-[10px] font-semibold";

/**
 * The event's stat sheet, filled in. Laid out like the paper form the crew completes at the end of
 * an event: unit counts across the top, each financing, check, layaway and cash sale listed
 * underneath, and the summary box at the bottom. Printed as the first page of an event's sheets.
 */
const StatSheet = ({ saleEvent, stats, orders }: Props) => {
    const entries = (method: PaymentMethod): Entry[] =>
        orders.flatMap((order) =>
            (order.payments ?? [])
                .filter((p) => p.method === method)
                .map((p, index) => ({
                    key: `${order.id}-${p.id ?? index}`,
                    label:
                        method === "Check" && p.checkNumber
                            ? `#${order.orderNumber} ck ${p.checkNumber}`
                            : `#${order.orderNumber}`,
                    amount: p.amount ?? 0,
                }))
        );

    const financing = entries("Financing");
    const checks = entries("Check");
    const layaway = entries("Layaway");
    const cash = entries("Cash");

    const units = stats?.mattressAndBaseCount ?? 0;
    // As on the paper sheet: total sales divided by the number of mattresses and bases.
    const averageSale = units > 0 ? (stats?.totalSales ?? 0) / units : 0;

    const count = (label: string, value: number | undefined, grow = false) => (
        <div className={`flex flex-col ${grow ? "flex-1" : ""}`}>
            <p className={heading}>{label}</p>
            <p
                className={`flex items-center justify-center py-2 text-2xl font-bold tabular-nums ${grow ? "flex-1" : ""}`}
            >
                {value ?? 0}
            </p>
            <p className={totalRow}>TOTAL: {value ?? 0}</p>
        </div>
    );

    const list = (label: string, rows: Entry[], minRows: number, grow = false) => {
        const total = rows.reduce((sum, r) => sum + r.amount, 0);
        const blanks = Math.max(0, minRows - rows.length);

        return (
            <div className={`flex flex-col ${grow ? "flex-1" : ""}`}>
                <p className={heading}>{label}</p>
                <div className={grow ? "flex-1" : ""}>
                    {rows.map((r) => (
                        <p
                            key={r.key}
                            className="flex justify-between border-b border-zinc-400 px-1 text-[10px] leading-[17px]"
                        >
                            <span className="text-zinc-600">{r.label}</span>
                            <span className="tabular-nums">{FormatCurrency(r.amount)}</span>
                        </p>
                    ))}
                    {Array.from({ length: blanks }).map((_, i) => (
                        <p key={i} className="border-b border-zinc-400 leading-[17px]">
                            &nbsp;
                        </p>
                    ))}
                </div>
                <p className={totalRow}>TOTAL: {rows.length ? FormatCurrency(total) : ""}</p>
            </div>
        );
    };

    const column = (children: ReactNode) => (
        <div className={`flex flex-col divide-y divide-black ${box}`}>{children}</div>
    );

    const summary: [string, string][] = [
        ["CREDIT/DEBIT CARDS", FormatCurrency(stats?.creditCardTotal)],
        ["CASH", FormatCurrency(stats?.cashTotal)],
        ["CHECKS", FormatCurrency(stats?.checkTotal)],
        ["FINANCING BALANCE", FormatCurrency(stats?.financingTotal)],
        ["LAYAWAY BALANCE", FormatCurrency(stats?.layawayTotal)],
    ];

    return (
        <div className="print-sheet mx-auto w-full max-w-[8in] bg-white p-6 font-sans text-black shadow-lg">
            <div className="mb-3 flex items-end justify-between">
                <div className="space-y-0.5 text-[11px] font-bold">
                    <p>
                        ORGANIZATION:{" "}
                        <span className="font-normal text-[13px]">{saleEvent?.organization}</span>
                    </p>
                    <p>
                        DATE:{" "}
                        <span className="font-normal text-[13px]">
                            {FormatShortDate(saleEvent?.eventDate)}
                        </span>
                    </p>
                </div>
                <p className="text-[12px] font-bold tracking-wide">FUNDRAISER STAT SHEET</p>
            </div>

            {/* Unit counts */}
            <div className="grid grid-cols-4">
                {column(count("Mattresses (incl. Purple/Helix)", stats?.mattressCount, true))}
                {column(
                    <>
                        {count("Purple", stats?.purpleCount)}
                        {count("Helix", stats?.helixCount)}
                    </>
                )}
                {column(count("Adjustable bases", stats?.adjustableBaseCount, true))}
                {column(
                    <>
                        {count("Mattress protectors", stats?.mattressProtectorCount)}
                        {count("Frames", stats?.frameCount)}
                    </>
                )}
            </div>

            {/* Itemised payments and the remaining counts */}
            <div className="mt-3 grid grid-cols-4">
                {column(list("Financing balance", financing, MIN_LIST_ROWS, true))}
                {column(list("Checks", checks, MIN_LIST_ROWS, true))}
                {column(
                    <>
                        {list("Layaway balance", layaway, 5)}
                        {list("Cash sales", cash, 6, true)}
                    </>
                )}
                {column(
                    <>
                        {count("Pillows", stats?.pillowCount)}
                        {count("Bean bag chairs", stats?.beanBagChairCount)}
                        {count("Sheets", stats?.sheetCount, (stats?.miscCount ?? 0) === 0)}
                        {(stats?.miscCount ?? 0) > 0 &&
                            count("Other items", stats?.miscCount, true)}
                    </>
                )}
            </div>

            {/* Summary box */}
            <div className={`mt-4 ${box} px-10 py-5`}>
                <dl className="mx-auto max-w-md space-y-2 text-[12px]">
                    {summary.map(([label, value]) => (
                        <div key={label} className="flex items-end gap-3">
                            <dt className="w-44 shrink-0 text-right font-bold">{label}:</dt>
                            <dd className="flex-1 border-b border-black text-right tabular-nums">
                                {value}
                            </dd>
                        </div>
                    ))}
                    <div className="h-2" />
                    <div className="flex items-end gap-3">
                        <dt className="w-44 shrink-0 text-right font-bold">TOTAL SALES:</dt>
                        <dd className="flex-1 border-b border-black text-right font-bold tabular-nums">
                            {FormatCurrency(stats?.totalSales)}
                        </dd>
                    </div>
                    <div className="flex items-end gap-3">
                        <dt className="w-44 shrink-0 text-right font-bold">
                            # OF MATTS/ADJ. BASES:
                        </dt>
                        <dd className="flex-1 border-b border-black text-right tabular-nums">
                            {units}
                        </dd>
                    </div>
                    <div className="flex items-end gap-3">
                        <dt className="w-44 shrink-0 text-right font-bold">AVERAGE SALE:</dt>
                        <dd className="flex-1 border-b border-black text-right tabular-nums">
                            {FormatCurrency(averageSale)}
                        </dd>
                    </div>
                </dl>
                <p className="mt-4 text-center text-[9px] text-zinc-600">
                    {stats?.completedOrderCount ?? 0} completed sale
                    {(stats?.completedOrderCount ?? 0) === 1 ? "" : "s"} &middot; net before tax{" "}
                    {FormatCurrency(stats?.netSales)} &middot; tax{" "}
                    {FormatCurrency(stats?.taxCollected)}
                    {(stats?.outstandingBalance ?? 0) > 0 &&
                        ` · outstanding ${FormatCurrency(stats?.outstandingBalance)}`}
                </p>
            </div>
        </div>
    );
};

export default StatSheet;
