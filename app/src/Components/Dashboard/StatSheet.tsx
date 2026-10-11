import { Children, isValidElement } from "react";
import type { ReactNode, Ref } from "react";
import { View } from "react-native";
import { SheetText } from "../Checkout/SheetTable";
import { FormatCurrency, FormatShortDate } from "../../Lib/ModelHelpers";
import { SHEET_WIDTH } from "../../Lib/SheetPdf";
import type { DashboardStats } from "../../Models/DashboardStats";
import type { Event } from "../../Models/Event";
import type { Order } from "../../Models/Order";
import type { PaymentMethod } from "../../Models/OrderPayment";

type Props = {
    saleEvent: Event | null;
    stats: DashboardStats | null;
    orders: Order[];
    /** The sheet itself, for capturing into a PDF. */
    sheetRef?: Ref<View>;
};

type Entry = { key: string; label: string; amount: number };

/** Minimum ruled lines per itemised column, so a quiet event still looks like the paper form. */
const MIN_LIST_ROWS = 14;

const BLACK = "#000";
const RULE = "#a1a1aa";

/** A column's heading, e.g. MATTRESSES. */
const Heading = ({ label }: { label: string }) => (
    <View style={{ borderBottomWidth: 1, borderColor: BLACK, paddingHorizontal: 4, paddingVertical: 2 }}>
        <SheetText size={9} bold align="center" style={{ textTransform: "uppercase" }}>
            {label}
        </SheetText>
    </View>
);

/** A column's TOTAL line. */
const Total = ({ children }: { children: ReactNode }) => (
    <View style={{ borderTopWidth: 1, borderColor: BLACK, paddingHorizontal: 4, paddingVertical: 2 }}>
        <SheetText size={10} semibold>
            {children}
        </SheetText>
    </View>
);

/** Whether a part of a column takes up the column's spare height. */
const Grows = (child: ReactNode) =>
    isValidElement(child) && (child.props as { grow?: boolean }).grow === true;

/** One boxed column of the sheet, its parts divided by ruled lines. */
const Column = ({ children }: { children: ReactNode }) => (
    <View style={{ flex: 1, borderWidth: 1, borderColor: BLACK, marginLeft: -1 }}>
        {Children.toArray(children).map((child, index) => (
            <View
                key={index}
                style={{
                    flexGrow: Grows(child) ? 1 : 0,
                    borderTopWidth: index > 0 ? 1 : 0,
                    borderColor: BLACK,
                }}
            >
                {child}
            </View>
        ))}
    </View>
);

/** A unit count: heading, the number, and its total. */
const Count = ({ label, value, grow = false }: { label: string; value: number | undefined; grow?: boolean }) => (
    <View style={{ flexGrow: grow ? 1 : 0 }}>
        <Heading label={label} />
        <View style={{ flexGrow: grow ? 1 : 0, alignItems: "center", justifyContent: "center", paddingVertical: 8 }}>
            <SheetText size={24} bold>
                {value ?? 0}
            </SheetText>
        </View>
        <Total>TOTAL: {value ?? 0}</Total>
    </View>
);

/** An itemised list of payments, ruled down to at least a set number of lines. */
const List = ({ label, rows, minRows, grow = false }: { label: string; rows: Entry[]; minRows: number; grow?: boolean }) => {
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    const blanks = Math.max(0, minRows - rows.length);

    return (
        <View style={{ flexGrow: grow ? 1 : 0 }}>
            <Heading label={label} />
            <View style={{ flexGrow: grow ? 1 : 0 }}>
                {rows.map((r) => (
                    <View
                        key={r.key}
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            borderBottomWidth: 1,
                            borderColor: RULE,
                            paddingHorizontal: 4,
                            height: 17,
                            alignItems: "center",
                        }}
                    >
                        <SheetText size={10} color="#52525b">
                            {r.label}
                        </SheetText>
                        <SheetText size={10}>{FormatCurrency(r.amount)}</SheetText>
                    </View>
                ))}
                {Array.from({ length: blanks }).map((_, i) => (
                    <View key={i} style={{ height: 17, borderBottomWidth: 1, borderColor: RULE }} />
                ))}
            </View>
            <Total>TOTAL: {rows.length ? FormatCurrency(total) : ""}</Total>
        </View>
    );
};

/** A line of the summary box: the label, then the value on a rule. */
const SummaryLine = ({ label, value, bold = false }: { label: string; value: string | number; bold?: boolean }) => (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
        <SheetText size={12} bold align="right" style={{ width: 176 }}>
            {label}:
        </SheetText>
        <View style={{ flex: 1, borderBottomWidth: 1, borderColor: BLACK }}>
            <SheetText size={12} bold={bold} align="right">
                {value}
            </SheetText>
        </View>
    </View>
);

/**
 * The event's stat sheet, filled in. Laid out like the paper form the crew completes at the end of
 * an event: unit counts across the top, each financing, check, layaway and cash sale listed
 * underneath, and the summary box at the bottom. Printed as the first page of an event's sheets.
 */
const StatSheet = ({ saleEvent, stats, orders, sheetRef }: Props) => {
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
    const misc = stats?.miscCount ?? 0;

    const summary: [string, string][] = [
        ["CREDIT/DEBIT CARDS", FormatCurrency(stats?.creditCardTotal)],
        ["CASH", FormatCurrency(stats?.cashTotal)],
        ["CHECKS", FormatCurrency(stats?.checkTotal)],
        ["FINANCING BALANCE", FormatCurrency(stats?.financingTotal)],
        ["LAYAWAY BALANCE", FormatCurrency(stats?.layawayTotal)],
    ];

    return (
        <View
            ref={sheetRef}
            collapsable={false}
            style={{ width: SHEET_WIDTH, backgroundColor: "#fff", padding: 24, overflow: "hidden" }}
        >
            <View style={{ marginBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                <View style={{ gap: 2 }}>
                    <SheetText size={11} bold>
                        ORGANIZATION: <SheetText size={13}>{saleEvent?.organization ?? ""}</SheetText>
                    </SheetText>
                    <SheetText size={11} bold>
                        DATE: <SheetText size={13}>{FormatShortDate(saleEvent?.eventDate)}</SheetText>
                    </SheetText>
                </View>
                <SheetText size={12} bold style={{ letterSpacing: 0.3 }}>
                    FUNDRAISER STAT SHEET
                </SheetText>
            </View>

            {/* Unit counts */}
            <View style={{ flexDirection: "row", marginLeft: 1 }}>
                <Column>
                    <Count label="Mattresses (incl. Purple/Helix)" value={stats?.mattressCount} grow />
                </Column>
                <Column>
                    <Count label="Purple" value={stats?.purpleCount} />
                    <Count label="Helix" value={stats?.helixCount} />
                </Column>
                <Column>
                    <Count label="Adjustable bases" value={stats?.adjustableBaseCount} grow />
                </Column>
                <Column>
                    <Count label="Mattress protectors" value={stats?.mattressProtectorCount} />
                    <Count label="Frames" value={stats?.frameCount} />
                </Column>
            </View>

            {/* Itemised payments and the remaining counts */}
            <View style={{ marginTop: 12, flexDirection: "row", marginLeft: 1 }}>
                <Column>
                    <List label="Financing balance" rows={financing} minRows={MIN_LIST_ROWS} grow />
                </Column>
                <Column>
                    <List label="Checks" rows={checks} minRows={MIN_LIST_ROWS} grow />
                </Column>
                <Column>
                    <List label="Layaway balance" rows={layaway} minRows={5} />
                    <List label="Cash sales" rows={cash} minRows={6} grow />
                </Column>
                <Column>
                    <Count label="Pillows" value={stats?.pillowCount} />
                    <Count label="Bean bag chairs" value={stats?.beanBagChairCount} />
                    <Count label="Sheets" value={stats?.sheetCount} grow={misc === 0} />
                    {misc > 0 && <Count label="Other items" value={misc} grow />}
                </Column>
            </View>

            {/* Summary box */}
            <View style={{ marginTop: 16, borderWidth: 1, borderColor: BLACK, paddingHorizontal: 40, paddingVertical: 20 }}>
                <View style={{ width: "100%", maxWidth: 448, alignSelf: "center", gap: 8 }}>
                    {summary.map(([label, value]) => (
                        <SummaryLine key={label} label={label} value={value} />
                    ))}
                    <View style={{ height: 8 }} />
                    <SummaryLine label="TOTAL SALES" value={FormatCurrency(stats?.totalSales)} bold />
                    <SummaryLine label="# OF MATTS/ADJ. BASES" value={units} />
                    <SummaryLine label="AVERAGE SALE" value={FormatCurrency(averageSale)} />
                </View>
                <SheetText size={9} color="#52525b" align="center" style={{ marginTop: 16 }}>
                    {stats?.completedOrderCount ?? 0} completed sale
                    {(stats?.completedOrderCount ?? 0) === 1 ? "" : "s"} · net before tax{" "}
                    {FormatCurrency(stats?.netSales)} · tax {FormatCurrency(stats?.taxCollected)}
                    {(stats?.outstandingBalance ?? 0) > 0 &&
                        ` · outstanding ${FormatCurrency(stats?.outstandingBalance)}`}
                </SheetText>
            </View>
        </View>
    );
};

export default StatSheet;
