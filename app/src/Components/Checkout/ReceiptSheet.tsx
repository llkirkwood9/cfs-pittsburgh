import { Image } from "expo-image";
import { Fragment } from "react";
import type { Ref } from "react";
import { Text, View } from "react-native";
import { Blank, Cell, FieldLabel, Row, SheetText } from "./SheetTable";
import { RenderTermText } from "../Elements/TermText";
import { useSettings } from "../../Context/SettingsContext";
import {
    FinancingComments,
    FormatCurrency,
    FormatShortDate,
    FormatStampDate,
    PaymentMethodLabels,
    PrintsOnSalesSheet,
    SortLinesForPrint,
} from "../../Lib/ModelHelpers";
import { ChoicesText, LineDiscountText, LineHasDiscount } from "../../Lib/Pricing";
import { SHEET_WIDTH } from "../../Lib/SheetPdf";
import { TermFor } from "../../Models/GeneralSettings";
import type { SalesTerm, SalesTermKey } from "../../Models/GeneralSettings";
import type { Order, OrderStatus } from "../../Models/Order";
import type { PaymentMethod } from "../../Models/OrderPayment";

type Props = {
    order: Order;
    /** The sheet itself, for capturing into a PDF. */
    sheetRef?: Ref<View>;
};

/** Blank rows are padded out to this many so the printed grid matches the paper form. */
const MIN_ITEM_ROWS = 14;

/** Height of one item row on the paper form. The grid never grows taller than 14 of these. */
const ROW_PX = 20;

/** The shortest a row can get and still be readable. */
const MIN_ROW_PX = 12;

/** What a sheet for an unfinished order is stamped with, on screen and on paper. */
const unfinished: Partial<Record<OrderStatus, { stamp: string; detail: string }>> = {
    Draft: {
        stamp: "NOT COMPLETED",
        detail: "This order is still being written up on the sales floor.",
    },
    AwaitingCheckout: {
        stamp: "NOT COMPLETED",
        detail: "This order is waiting at the checkout table and has not been paid.",
    },
    Voided: {
        stamp: "VOIDED",
        detail: "This order was voided and is not a valid sale.",
    },
};

/** The item grid's columns, as on the paper form; the description takes what is left. */
const COLUMNS = {
    brand: "10%",
    size: "6%",
    qty: "5%",
    takeWith: "5%",
    unit: "11%",
    discount: "9%",
    sale: "11%",
    total: "12%",
} as const;

/**
 * A copy of the CFS sales sheet, laid out at paper width whatever the screen. Everything here is
 * black on white with hard borders because it is photocopied and filed, not read on a screen. A
 * sheet always fits one page: with more lines than the paper grid holds, the rows get shorter,
 * and past that the PDF scales the page down.
 */
const ReceiptSheet = ({ order, sheetRef }: Props) => {
    const { settings } = useSettings();
    // A completed sale shows the wording the customer initialled; anything else, today's.
    const terms: SalesTerm[] = order.terms?.length ? order.terms : settings.terms;
    const term = (key: SalesTermKey) => TermFor(terms, key);
    const lines = SortLinesForPrint(order.lines ?? []).filter(PrintsOnSalesSheet);
    const notice = unfinished[order.status ?? "Draft"];
    const blanks = Math.max(0, MIN_ITEM_ROWS - lines.length - lines.filter((l) => l.notes).length);

    const noteRows = lines.filter((l) => l.notes).length;
    const rows = Math.max(lines.length + noteRows, MIN_ITEM_ROWS);
    const rowPx = Math.max(MIN_ROW_PX, Math.min(ROW_PX, Math.floor((MIN_ITEM_ROWS * ROW_PX) / rows)));
    const compact = rowPx < ROW_PX;
    const rowFont = rowPx >= ROW_PX ? 11 : rowPx >= 15 ? 10 : 9;

    const paidBy = (method: PaymentMethod): string => {
        const paid = (order.payments ?? []).filter((p) => p.method === method);
        if (paid.length === 0) return "";
        return FormatCurrency(paid.reduce((sum, p) => sum + (p.amount ?? 0), 0));
    };

    // The rep who wrote the sale and whoever checked the customer out. One name when they are
    // the same person, or before checkout has happened.
    const salesName = order.cfsRepName?.trim() ?? "";
    const checkoutName = order.completedByName?.trim() ?? "";
    const showCheckout =
        checkoutName !== "" && checkoutName.toLowerCase() !== salesName.toLowerCase();

    const hasLayaway = (order.payments ?? []).some((p) => p.method === "Layaway");

    const checkNumbers = (order.payments ?? [])
        .filter((p) => p.method === "Check" && p.checkNumber)
        .map((p) => p.checkNumber)
        .join(", ");

    // Each financing payment's type, number and amount, printed under the comments.
    const financing = FinancingComments(order);

    const cardFee =
        (order.ccProcessingFee ?? 0) > 0
            ? FormatCurrency(order.ccProcessingFee)
            : order.waiveCcProcessingFee && (order.payments ?? []).some((p) => p.method === "VisaMc")
              ? "Waived"
              : "—";

    const addressBlock = (side: "billing" | "delivery") => {
        const get = (key: string): string =>
            ((order as unknown as Record<string, string | null | undefined>)[side + key] ?? "") || "";
        const field = (labelText: string, value: string, size = 10) => (
            <SheetText size={size}>
                <FieldLabel>{labelText}</FieldLabel>
                {value}
            </SheetText>
        );

        return (
            <View>
                <Row>
                    <Cell flex={1} height={22}>{field("Name:", get("Name"), 11)}</Cell>
                </Row>
                <Row>
                    <Cell flex={1} height={22}>{field("Address:", get("Address"), 11)}</Cell>
                </Row>
                <Row>
                    <Cell width="33.4%" height={20}>{field("Unit #:", get("Unit"))}</Cell>
                    <Cell width="33.3%" height={20}>{field("Floor:", get("Floor"))}</Cell>
                    <Cell flex={1} height={20}>{field("Suite #:", get("Suite"))}</Cell>
                </Row>
                <Row>
                    <Cell width="33.4%" height={20}>{field("City:", get("City"))}</Cell>
                    <Cell width="33.3%" height={20}>{field("State:", get("State"))}</Cell>
                    <Cell flex={1} height={20}>{field("Zip:", get("Zip"))}</Cell>
                </Row>
                <Row>
                    <Cell width="66.7%" height={20}>{field("Cell #:", get("Cell"))}</Cell>
                    <Cell flex={1} height={20}>{field("Alt. #:", get("Alt"))}</Cell>
                </Row>
                <Row>
                    <Cell flex={1} height={20}>{field("Email:", get("Email"))}</Cell>
                </Row>
            </View>
        );
    };

    const initialled = (key: SalesTermKey, initials: string | null | undefined, align?: "right") => (
        <SheetText size={9} serif align={align} style={{ lineHeight: 11.25 }}>
            {term(key).heading ? (
                <Text style={{ fontWeight: "700", textDecorationLine: "underline" }}>
                    {term(key).heading}:{" "}
                </Text>
            ) : null}
            {RenderTermText(term(key).text)}{" "}
            <Text style={{ fontWeight: "700" }}>
                INITIAL <Blank value={initials} />
            </Text>
        </SheetText>
    );

    const itemCell = (
        content: React.ReactNode,
        width: string | undefined,
        align: "left" | "center" | "right" = "left",
        extra?: object
    ) => (
        <Cell
            width={width as `${number}%` | undefined}
            flex={width ? undefined : 1}
            height={rowPx}
            align={align}
            middle={compact}
            style={[compact ? { paddingVertical: 0 } : null, extra]}
        >
            {content}
        </Cell>
    );

    const item = (text: React.ReactNode, align?: "left" | "center" | "right", bold = false) => (
        <SheetText size={rowFont} align={align} semibold={bold} style={{ lineHeight: rowFont * 1.1 }}>
            {text}
        </SheetText>
    );

    // The comments, payments and totals block: comments on the left, then four columns - method,
    // amount, total label, total - so each payment row lines up with the headings above it.
    const paymentRows: [string, string, string, string, boolean?][] = [
        [PaymentMethodLabels.VisaMc, paidBy("VisaMc"), "Sales Tax", FormatCurrency(order.taxAmount)],
        ["Cash", paidBy("Cash"), "Total", FormatCurrency((order.subtotal ?? 0) + (order.taxAmount ?? 0)), true],
        [`Check #${checkNumbers ? ` ${checkNumbers}` : ""}`, paidBy("Check"), "CC Processing Fee", cardFee],
        ["Financing", paidBy("Financing"), "Balance Due", FormatCurrency(order.total), true],
    ];
    if (hasLayaway) paymentRows.push(["Layaway", paidBy("Layaway"), "", ""]);
    // Widths within the right-hand part, which is 54% of the sheet.
    const pw = { method: "27.8%", amount: "20.4%", label: "27.8%" } as const;

    return (
        <View
            ref={sheetRef}
            collapsable={false}
            style={{ width: SHEET_WIDTH, backgroundColor: "#fff", padding: 16, overflow: "hidden" }}
        >
            {/* An unfinished order is stamped across the whole sheet so a printed copy can never
                be mistaken for a final sale. */}
            {notice && (
                <View
                    pointerEvents="none"
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 88,
                            fontWeight: "900",
                            letterSpacing: 8,
                            color: "rgba(220, 38, 38, 0.2)",
                            transform: [{ rotate: "-30deg" }],
                        }}
                        numberOfLines={1}
                    >
                        {notice.stamp}
                    </Text>
                </View>
            )}

            {/* Masthead */}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                    <SheetText size={22} bold>
                        {settings.companyName}
                    </SheetText>
                    <SheetText size={11} bold>
                        Customer Service: {settings.customerServicePhone}
                    </SheetText>
                </View>
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                    <SheetText size={15} bold color="#dc2626">
                        N
                    </SheetText>
                    <SheetText size={9} bold color="#dc2626" style={{ textDecorationLine: "underline" }}>
                        o
                    </SheetText>
                    <SheetText size={15} bold color="#dc2626">
                        {" "}
                        {order.orderNumber}
                    </SheetText>
                </View>
            </View>

            {notice && (
                <View style={{ marginTop: 4, borderWidth: 2, borderColor: "#dc2626", paddingHorizontal: 8, paddingVertical: 4 }}>
                    <SheetText size={11} bold color="#b91c1c" align="center">
                        {notice.stamp} - NOT A FINAL SALES SHEET. {notice.detail}
                    </SheetText>
                </View>
            )}

            {/* Header row */}
            <View style={{ marginTop: 4 }}>
                <Row>
                    {[
                        ["Sale Date", "14%"],
                        ["Organization", "22%"],
                        ["Advertising Source", "20%"],
                        ["Referral Name", "22%"],
                        ["CFS Rep Name", undefined],
                    ].map(([text, width]) => (
                        <Cell key={text} width={width as `${number}%` | undefined} flex={width ? undefined : 1} align="center">
                            <SheetText semibold>{text}</SheetText>
                        </Cell>
                    ))}
                </Row>
                <Row>
                    <Cell width="14%" height={24} align="center" middle>
                        <SheetText size={11}>{FormatShortDate(order.saleDate)}</SheetText>
                    </Cell>
                    <Cell width="22%" height={24} align="center" middle>
                        <SheetText size={11}>{order.organization}</SheetText>
                    </Cell>
                    <Cell width="20%" height={24} align="center" middle>
                        <SheetText size={11}>{order.advertisingSource}</SheetText>
                    </Cell>
                    <Cell width="22%" height={24} align="center" middle>
                        <SheetText size={11}>{order.referralName}</SheetText>
                    </Cell>
                    <Cell flex={1} height={24} align="center" middle>
                        {showCheckout ? (
                            <>
                                {salesName ? (
                                    <SheetText size={11} align="center">
                                        <SheetText size={8} bold>SALES: </SheetText>
                                        {salesName}
                                    </SheetText>
                                ) : null}
                                <SheetText size={11} align="center">
                                    <SheetText size={8} bold>CHECKOUT: </SheetText>
                                    {checkoutName}
                                </SheetText>
                            </>
                        ) : (
                            <SheetText size={11} align="center">
                                {salesName || checkoutName}
                            </SheetText>
                        )}
                    </Cell>
                </Row>
            </View>

            {/* Billing and delivery blocks */}
            <View style={{ marginTop: 4 }}>
                <Row>
                    <Cell width="50%" align="center">
                        <SheetText size={11} semibold>Customer Billing Name and Address</SheetText>
                    </Cell>
                    <Cell flex={1} align="center">
                        <SheetText size={11} semibold>Delivery Address (If different from billing)</SheetText>
                    </Cell>
                </Row>
                <Row>
                    <Cell width="50%" padded={false}>
                        <View style={{ width: "100%" }}>{addressBlock("billing")}</View>
                    </Cell>
                    <Cell flex={1} padded={false}>
                        <View style={{ width: "100%" }}>{addressBlock("delivery")}</View>
                    </Cell>
                </Row>
            </View>
            <View style={{ marginTop: 2 }}>
                {initialled("customerInfo", order.customerInfoInitials, "right")}
            </View>

            {/* Line items */}
            <View style={{ marginTop: 4 }}>
                <Row>
                    <Cell width={COLUMNS.brand} align="center"><SheetText semibold>Brand</SheetText></Cell>
                    <Cell width={COLUMNS.size} align="center"><SheetText semibold>Size</SheetText></Cell>
                    <Cell flex={1} align="center">
                        <SheetText semibold>
                            Description <SheetText size={7}>(model name, type, matt, box)</SheetText>
                        </SheetText>
                    </Cell>
                    <Cell width={COLUMNS.qty} align="center"><SheetText semibold>Qty</SheetText></Cell>
                    <Cell width={COLUMNS.takeWith} align="center">
                        <SheetText size={8} semibold align="center" style={{ lineHeight: 8 }}>
                            Take{"\n"}With
                        </SheetText>
                    </Cell>
                    <Cell width={COLUMNS.unit} align="center"><SheetText semibold>Unit Price</SheetText></Cell>
                    <Cell width={COLUMNS.discount} align="center"><SheetText semibold>Discount</SheetText></Cell>
                    <Cell width={COLUMNS.sale} align="center"><SheetText semibold>Sale Price</SheetText></Cell>
                    <Cell width={COLUMNS.total} align="center"><SheetText semibold>Total</SheetText></Cell>
                </Row>

                {lines.map((line) => (
                    <Fragment key={line.id}>
                        <Row>
                            {itemCell(item(line.brand), COLUMNS.brand)}
                            {itemCell(item(line.size, "center"), COLUMNS.size, "center")}
                            {itemCell(
                                item(
                                    <>
                                        {line.lineType === "Delivery" && (
                                            <SheetText size={8} bold>SHIP: </SheetText>
                                        )}
                                        {line.lineType === "Upcharge" && (
                                            <SheetText size={8} bold>UPCHARGE: </SheetText>
                                        )}
                                        {line.description}
                                        {ChoicesText(line.choices) ? (
                                            <Text style={{ fontWeight: "600" }}> - {ChoicesText(line.choices)}</Text>
                                        ) : null}
                                        {line.lineType === "Included" && (
                                            <SheetText size={9} italic> (included)</SheetText>
                                        )}
                                    </>
                                ),
                                undefined,
                                "left",
                                line.parentLineId ? { paddingLeft: 16 } : undefined
                            )}
                            {itemCell(
                                item(line.lineType === "Delivery" ? "" : line.quantity, "center"),
                                COLUMNS.qty,
                                "center"
                            )}
                            {itemCell(item(line.takeWith ? "X" : "", "center"), COLUMNS.takeWith, "center")}
                            {itemCell(
                                item(line.lineType === "Included" ? "Incl." : FormatCurrency(line.unitPrice), "right"),
                                COLUMNS.unit,
                                "right"
                            )}
                            {/* A catalog sale and the rep's own discount both show, e.g. "20% + $100". */}
                            {itemCell(item(LineDiscountText(line), "center"), COLUMNS.discount, "center")}
                            {itemCell(
                                item(LineHasDiscount(line) ? FormatCurrency(line.salePrice) : "", "right"),
                                COLUMNS.sale,
                                "right"
                            )}
                            {itemCell(
                                item(
                                    line.lineType === "Included" ? "Incl." : FormatCurrency(line.lineTotal),
                                    "right",
                                    true
                                ),
                                COLUMNS.total,
                                "right"
                            )}
                        </Row>
                        {line.notes ? (
                            <Row>
                                <Cell width={COLUMNS.brand} />
                                <Cell width={COLUMNS.size} />
                                <Cell flex={1} style={{ paddingLeft: 16 }}>
                                    <SheetText size={rowFont} italic>
                                        <SheetText size={8} bold>NOTE: </SheetText>
                                        {line.notes}
                                    </SheetText>
                                </Cell>
                            </Row>
                        ) : null}
                    </Fragment>
                ))}

                {Array.from({ length: blanks }).map((_, index) => (
                    <Row key={`blank-${index}`}>
                        {[COLUMNS.brand, COLUMNS.size, undefined, COLUMNS.qty, COLUMNS.takeWith, COLUMNS.unit, COLUMNS.discount, COLUMNS.sale, COLUMNS.total].map(
                            (width, col) => (
                                <Cell key={col} width={width} flex={width ? undefined : 1} height={rowPx} />
                            )
                        )}
                    </Row>
                ))}
            </View>

            {/* Comments, payment options and totals */}
            <View style={{ marginTop: 4, flexDirection: "row" }}>
                <View style={{ width: "46%" }}>
                    <Row>
                        <Cell flex={1} align="center"><SheetText semibold>Comments:</SheetText></Cell>
                    </Row>
                    <Row style={{ flex: 1 }}>
                        <Cell flex={1}>
                            <SheetText size={11}>{order.comments}</SheetText>
                            {financing.map((financed, index) => (
                                <SheetText key={index} size={11} semibold>
                                    {financed}
                                </SheetText>
                            ))}
                        </Cell>
                    </Row>
                </View>
                <View style={{ flex: 1 }}>
                    <Row>
                        <Cell width="48.2%" align="center"><SheetText semibold>Payment Options</SheetText></Cell>
                        <Cell width={pw.label}><SheetText semibold>Subtotal</SheetText></Cell>
                        <Cell flex={1} align="right"><SheetText>{FormatCurrency(order.subtotal)}</SheetText></Cell>
                    </Row>
                    {paymentRows.map(([method, amount, totalLabel, total, bold]) => (
                        <Row key={method}>
                            <Cell width={pw.method} align="center"><SheetText semibold>{method}</SheetText></Cell>
                            <Cell width={pw.amount} align="right"><SheetText>{amount}</SheetText></Cell>
                            <Cell width={pw.label}>
                                <SheetText size={totalLabel === "CC Processing Fee" ? 9 : 10} semibold>
                                    {totalLabel || " "}
                                </SheetText>
                            </Cell>
                            <Cell flex={1} align="right"><SheetText bold={bold}>{total}</SheetText></Cell>
                        </Row>
                    ))}
                </View>
            </View>

            {/* Acknowledgements: the wording set under Settings, or the copy kept with a completed sale */}
            <View style={{ marginTop: 8, gap: 4 }}>
                {initialled("warranty", order.warrantyInitials)}
                {initialled("dropShip", order.dropShipInitials)}
                {initialled("advisory", order.advisoryInitials)}
            </View>

            {/* Signature row */}
            <View style={{ marginTop: 4 }}>
                <Row>
                    <Cell width="45%" height={34} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <SheetText><FieldLabel>Customer Signature:</FieldLabel></SheetText>
                        {order.customerSignature ? (
                            <Image
                                source={{ uri: order.customerSignature }}
                                contentFit="contain"
                                style={{ width: 160, height: 30 }}
                            />
                        ) : null}
                    </Cell>
                    <Cell width="35%" height={34}>
                        <SheetText size={11}>
                            <FieldLabel>Customer Name:</FieldLabel>
                            {order.customerSignatureName}
                        </SheetText>
                    </Cell>
                    <Cell flex={1} height={34}>
                        <SheetText size={11}>
                            <FieldLabel>Date:</FieldLabel>
                            {FormatStampDate(order.signedDate)}
                        </SheetText>
                    </Cell>
                </Row>
            </View>

            <View style={{ marginTop: 6, flexDirection: "row", gap: 16 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end" }}>
                    <SheetText bold>RECEIVED BY: </SheetText>
                    <View style={{ flex: 1, borderBottomWidth: 1, borderColor: "#000", height: 12 }} />
                </View>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end" }}>
                    <SheetText bold>Date: </SheetText>
                    <View style={{ flex: 1, borderBottomWidth: 1, borderColor: "#000", height: 12 }} />
                </View>
            </View>
        </View>
    );
};

export default ReceiptSheet;
