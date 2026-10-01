import { Fragment } from "react";
import type { CSSProperties } from "react";
import {
    FormatCurrency,
    FormatShortDate,
    FormatStampDate,
    PaymentMethodLabels,
    PrintsOnSalesSheet,
    SortLinesForPrint,
} from "../../Lib/ModelHelpers";
import { useSettings } from "../../Context/SettingsContext";
import type { Order, OrderStatus } from "../../Models/Order";
import type { PaymentMethod } from "../../Models/OrderPayment";

type Props = {
    order: Order;
};

/** Blank rows are padded out to this many so the printed grid matches the paper form. */
const MIN_ITEM_ROWS = 14;

/** Height of one item row on the paper form. The grid never grows taller than 14 of these. */
const ROW_PX = 20;

/** The shortest a row can get and still be readable. */
const MIN_ROW_PX = 12;

/** Roughly how tall a sheet prints with the standard grid, in CSS pixels. */
const SHEET_PX = 940;

const cell = "border border-black px-1 py-[3px] align-top";

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
const label = "text-[8px] font-bold uppercase leading-none";

/**
 * Pixel-for-pixel a copy of the CFS sales sheet, rendered for the printer. Everything here is
 * black on white with hard borders because it is photocopied and filed, not read on a screen.
 */
const ReceiptSheet = ({ order }: Props) => {
    const { settings } = useSettings();
    const lines = SortLinesForPrint(order.lines ?? []).filter(PrintsOnSalesSheet);
    const notice = unfinished[order.status ?? "Draft"];
    const blanks = Math.max(0, MIN_ITEM_ROWS - lines.length - lines.filter((l) => l.notes).length);

    // A sheet always prints on one page. With more lines than the paper grid holds, the rows get
    // shorter so the grid stays the same height; past what that can absorb, the whole sheet is
    // scaled down on paper.
    const noteRows = lines.filter((l) => l.notes).length;
    const rows = Math.max(lines.length + noteRows, MIN_ITEM_ROWS);
    const gridBudget = MIN_ITEM_ROWS * ROW_PX;
    const rowPx = Math.max(MIN_ROW_PX, Math.min(ROW_PX, Math.floor(gridBudget / rows)));
    const compact = rowPx < ROW_PX;
    const overflowPx = Math.max(0, rows * rowPx - gridBudget);
    const printZoom = overflowPx > 0 ? SHEET_PX / (SHEET_PX + overflowPx) : 1;
    const rowStyle = {
        height: rowPx,
        fontSize: rowPx >= ROW_PX ? 11 : rowPx >= 15 ? 10 : 9,
        lineHeight: 1.1,
    };
    const itemCell = compact ? "border border-black px-1 py-0 align-middle" : cell;

    const paidBy = (method: PaymentMethod): string => {
        const rows = (order.payments ?? []).filter((p) => p.method === method);
        if (rows.length === 0) return "";
        return FormatCurrency(rows.reduce((sum, p) => sum + (p.amount ?? 0), 0));
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

    const addressBlock = (side: "billing" | "delivery") => {
        const get = (key: string): string => {
            const field = side + key;
            return (
                ((order as unknown as Record<string, string | null | undefined>)[field] ?? "") || ""
            );
        };

        return (
            <table className="w-full border-collapse text-[10px]">
                <tbody>
                    <tr>
                        <td className={`${cell} h-[22px]`} colSpan={3}>
                            <span className={label}>Name:</span>{" "}
                            <span className="text-[11px]">{get("Name")}</span>
                        </td>
                    </tr>
                    <tr>
                        <td className={`${cell} h-[22px]`} colSpan={3}>
                            <span className={label}>Address:</span>{" "}
                            <span className="text-[11px]">{get("Address")}</span>
                        </td>
                    </tr>
                    <tr>
                        <td className={`${cell} h-[20px] w-1/3`}>
                            <span className={label}>Unit #:</span> {get("Unit")}
                        </td>
                        <td className={`${cell} h-[20px] w-1/3`}>
                            <span className={label}>Floor:</span> {get("Floor")}
                        </td>
                        <td className={`${cell} h-[20px] w-1/3`}>
                            <span className={label}>Suite #:</span> {get("Suite")}
                        </td>
                    </tr>
                    <tr>
                        <td className={`${cell} h-[20px]`}>
                            <span className={label}>City:</span> {get("City")}
                        </td>
                        <td className={`${cell} h-[20px]`}>
                            <span className={label}>State:</span> {get("State")}
                        </td>
                        <td className={`${cell} h-[20px]`}>
                            <span className={label}>Zip:</span> {get("Zip")}
                        </td>
                    </tr>
                    <tr>
                        <td className={`${cell} h-[20px]`} colSpan={2}>
                            <span className={label}>Cell #:</span> {get("Cell")}
                        </td>
                        <td className={`${cell} h-[20px]`}>
                            <span className={label}>Alt. #:</span> {get("Alt")}
                        </td>
                    </tr>
                    <tr>
                        <td className={`${cell} h-[20px]`} colSpan={3}>
                            <span className={label}>Email:</span> {get("Email")}
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    };

    return (
        <div
            className="print-sheet relative mx-auto w-full max-w-[8in] overflow-hidden bg-white p-4 font-sans text-black shadow-lg"
            style={{ "--print-zoom": printZoom } as CSSProperties}
        >
            {/* An unfinished order is stamped across the whole sheet so a printed copy can never
                be mistaken for a final sale. */}
            {notice && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                >
                    <span className="-rotate-[30deg] select-none whitespace-nowrap text-[88px] font-black tracking-widest text-red-600/20">
                        {notice.stamp}
                    </span>
                </div>
            )}

            {/* Masthead */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-[22px] font-bold leading-tight tracking-tight">
                        {settings.companyName}
                    </h1>
                    <p className="text-[11px] font-bold">
                        Customer Service: {settings.customerServicePhone}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[15px] font-bold text-red-600">
                        N<span className="align-super text-[9px] underline">o</span>{" "}
                        {order.orderNumber}
                    </p>
                </div>
            </div>

            {notice && (
                <div className="mt-1 border-2 border-red-600 px-2 py-1 text-center text-[11px] font-bold text-red-700">
                    {notice.stamp} - NOT A FINAL SALES SHEET. {notice.detail}
                </div>
            )}

            {/* Header row */}
            <table className="mt-1 w-full border-collapse text-center text-[10px]">
                <tbody>
                    <tr>
                        <td className={`${cell} w-[14%] text-center font-semibold`}>Sale Date</td>
                        <td className={`${cell} w-[22%] text-center font-semibold`}>
                            Organization
                        </td>
                        <td className={`${cell} w-[20%] text-center font-semibold`}>
                            Advertising Source
                        </td>
                        <td className={`${cell} w-[22%] text-center font-semibold`}>
                            Referral Name
                        </td>
                        <td className={`${cell} w-[22%] text-center font-semibold`}>
                            CFS Rep Name
                        </td>
                    </tr>
                    <tr className="text-[11px]">
                        <td className={`${cell} h-[24px] text-center`}>
                            {FormatShortDate(order.saleDate)}
                        </td>
                        <td className={`${cell} h-[24px] text-center`}>{order.organization}</td>
                        <td className={`${cell} h-[24px] text-center`}>
                            {order.advertisingSource}
                        </td>
                        <td className={`${cell} h-[24px] text-center`}>{order.referralName}</td>
                        <td className={`${cell} h-[24px] text-center leading-tight`}>
                            {showCheckout ? (
                                <>
                                    {salesName && (
                                        <span className="block">
                                            <span className="text-[8px] font-bold">SALES:</span>{" "}
                                            {salesName}
                                        </span>
                                    )}
                                    <span className="block">
                                        <span className="text-[8px] font-bold">CHECKOUT:</span>{" "}
                                        {checkoutName}
                                    </span>
                                </>
                            ) : (
                                salesName || checkoutName
                            )}
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Billing and delivery blocks */}
            <table className="mt-1 w-full border-collapse">
                <tbody>
                    <tr>
                        <td className={`${cell} w-1/2 text-center text-[11px] font-semibold`}>
                            Customer Billing Name and Address
                        </td>
                        <td className={`${cell} w-1/2 text-center text-[11px] font-semibold`}>
                            Delivery Address (If different from billing)
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black p-0 align-top">
                            {addressBlock("billing")}
                        </td>
                        <td className="border border-black p-0 align-top">
                            {addressBlock("delivery")}
                        </td>
                    </tr>
                </tbody>
            </table>
            <p className="mt-0.5 text-right font-serif text-[9px]">
                Customer confirms the name, address, phone, email and delivery details above are
                correct.{" "}
                <span className="font-bold">
                    INITIAL{" "}
                    <span className="inline-block min-w-[3em] border-b border-black text-center font-normal">
                        {order.customerInfoInitials}
                    </span>
                </span>
            </p>

            {/* Line items */}
            <table className="mt-1 w-full border-collapse text-[10px]">
                <thead>
                    <tr className="text-center font-semibold">
                        <td className={`${cell} w-[10%] text-center`}>Brand</td>
                        <td className={`${cell} w-[6%] text-center`}>Size</td>
                        <td className={`${cell} text-center`}>
                            Description{" "}
                            <span className="text-[7px] font-normal">
                                (model name, type, matt, box)
                            </span>
                        </td>
                        <td className={`${cell} w-[5%] text-center`}>Qty</td>
                        <td className={`${cell} w-[5%] text-center text-[8px] leading-none`}>
                            Take
                            <br />
                            With
                        </td>
                        <td className={`${cell} w-[11%] text-center`}>Unit Price</td>
                        <td className={`${cell} w-[9%] text-center`}>Discount</td>
                        <td className={`${cell} w-[11%] text-center`}>Sale Price</td>
                        <td className={`${cell} w-[12%] text-center`}>Total</td>
                    </tr>
                </thead>
                <tbody>
                    {lines.map((line) => (
                        <Fragment key={line.id}>
                            <tr style={rowStyle}>
                                <td className={itemCell}>{line.brand}</td>
                                <td className={`${itemCell} text-center`}>{line.size}</td>
                                <td className={`${itemCell} ${line.parentLineId ? "pl-4" : ""}`}>
                                    {line.lineType === "Delivery" && (
                                        <span className="text-[8px] font-bold uppercase">
                                            Ship:{" "}
                                        </span>
                                    )}
                                    {line.description}
                                    {line.lineType === "Included" && (
                                        <span className="text-[9px] italic"> (included)</span>
                                    )}
                                </td>
                                <td className={`${itemCell} text-center`}>
                                    {line.lineType === "Delivery" ? "" : line.quantity}
                                </td>
                                <td className={`${itemCell} text-center`}>
                                    {line.takeWith ? "X" : ""}
                                </td>
                                <td className={`${itemCell} text-right`}>
                                    {line.lineType === "Included"
                                        ? "Incl."
                                        : FormatCurrency(line.unitPrice)}
                                </td>
                                <td className={`${itemCell} text-center`}>
                                    {(line.discountPercent ?? 0) > 0
                                        ? `${line.discountPercent}%`
                                        : ""}
                                </td>
                                <td className={`${itemCell} text-right`}>
                                    {(line.discountPercent ?? 0) > 0
                                        ? FormatCurrency(line.salePrice)
                                        : ""}
                                </td>
                                <td className={`${itemCell} text-right font-semibold`}>
                                    {line.lineType === "Included"
                                        ? "Incl."
                                        : FormatCurrency(line.lineTotal)}
                                </td>
                            </tr>
                            {line.notes && (
                                <tr style={{ ...rowStyle, height: "auto" }}>
                                    <td className={itemCell} />
                                    <td className={itemCell} />
                                    <td
                                        className={`${itemCell} whitespace-pre-line pl-4 italic`}
                                        colSpan={7}
                                    >
                                        <span className="text-[8px] font-bold uppercase not-italic">
                                            Note:{" "}
                                        </span>
                                        {line.notes}
                                    </td>
                                </tr>
                            )}
                        </Fragment>
                    ))}

                    {Array.from({ length: blanks }).map((_, index) => (
                        <tr key={`blank-${index}`} style={rowStyle}>
                            {Array.from({ length: 9 }).map((__, col) => (
                                <td key={col} className={itemCell}>
                                    &nbsp;
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Comments, payment options and totals. One grid of five columns - comments, payment
                method, amount, total label, total - so each payment row lines up with the Payment
                Options and Subtotal headings above it, as on the paper form. */}
            <table className="mt-1 w-full table-fixed border-collapse text-[10px]">
                <colgroup>
                    <col className="w-[46%]" />
                    <col className="w-[15%]" />
                    <col className="w-[11%]" />
                    <col className="w-[15%]" />
                    <col className="w-[13%]" />
                </colgroup>
                <tbody>
                    <tr>
                        <td className={`${cell} text-center font-semibold`}>Comments:</td>
                        <td className={`${cell} text-center font-semibold`} colSpan={2}>
                            Payment Options
                        </td>
                        <td className={`${cell} font-semibold`}>Subtotal</td>
                        <td className={`${cell} text-right`}>{FormatCurrency(order.subtotal)}</td>
                    </tr>
                    <tr>
                        <td
                            className={`${cell} align-top text-[11px]`}
                            rowSpan={hasLayaway ? 5 : 4}
                        >
                            {order.comments}
                        </td>
                        <td className={`${cell} text-center font-semibold`}>
                            {PaymentMethodLabels.VisaMc}
                        </td>
                        <td className={`${cell} text-right`}>{paidBy("VisaMc")}</td>
                        <td className={`${cell} font-semibold`}>Sales Tax</td>
                        <td className={`${cell} text-right`}>{FormatCurrency(order.taxAmount)}</td>
                    </tr>
                    <tr>
                        <td className={`${cell} text-center font-semibold`}>Cash</td>
                        <td className={`${cell} text-right`}>{paidBy("Cash")}</td>
                        <td className={`${cell} font-semibold`}>Total</td>
                        <td className={`${cell} text-right font-bold`}>
                            {FormatCurrency(order.total)}
                        </td>
                    </tr>
                    <tr>
                        <td className={`${cell} text-center font-semibold`}>
                            Check #{checkNumbers ? ` ${checkNumbers}` : ""}
                        </td>
                        <td className={`${cell} text-right`}>{paidBy("Check")}</td>
                        <td className={`${cell} text-[9px] font-semibold`}>CC Processing Fee</td>
                        <td className={`${cell} text-right`}>
                            {(order.ccProcessingFee ?? 0) > 0
                                ? FormatCurrency(order.ccProcessingFee)
                                : "—"}
                        </td>
                    </tr>
                    <tr>
                        <td className={`${cell} text-center font-semibold`}>Financing</td>
                        <td className={`${cell} text-right`}>{paidBy("Financing")}</td>
                        <td className={`${cell} font-semibold`}>Balance Due</td>
                        <td className={`${cell} text-right font-bold`}>
                            {FormatCurrency(order.balanceDue)}
                        </td>
                    </tr>
                    {hasLayaway && (
                        <tr>
                            <td className={`${cell} text-center font-semibold`}>Layaway</td>
                            <td className={`${cell} text-right`}>{paidBy("Layaway")}</td>
                            <td className={cell} colSpan={2}>
                                &nbsp;
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Acknowledgements, verbatim from the paper sheet */}
            <div className="mt-2 space-y-1 font-serif text-[9px] leading-[1.25]">
                <p>
                    <span className="font-bold underline">
                        Customer Service &amp; Warranty Information:
                    </span>{" "}
                    All products come with a manufacturer warranty. Customer service and warranty
                    issues are the responsibility of the manufacturer. All manufacturers require the
                    use of mattress protectors. They reserve the right to refuse service or
                    invalidate the warranty if there are any stains or soils present even if the
                    product is defective. Customer has been notified that sleep sets must be clean,
                    free of tears, burns, odors, pet hair and stains of any kind for the warranty to
                    be valid. In addition, manufacturer warranties only cover the cost of the
                    replacement item, not additional expenses such as delivery or set-up.{" "}
                    <span className="font-bold">
                        INITIAL{" "}
                        <span className="inline-block min-w-[3em] border-b border-black text-center font-normal">
                            {order.warrantyInitials}
                        </span>
                    </span>
                </p>
                <p>
                    <span className="font-bold underline">Drop Ship Delivery:</span>{" "}
                    <span className="font-bold">
                        ALL ITEMS WILL BE DROP SHIPPED DIRECTLY TO THE CUSTOMER UNLESS OTHERWISE
                        NOTED.
                    </span>{" "}
                    Items do not require a signature when delivered. The mattress will be
                    compressed, vacuum sealed and boxed. The product may be heavy and may require
                    additional persons to move it. Once open, the bed will completely recover within
                    24-48 hours, however, sleeping on it sooner will not damage the bed.{" "}
                    <span className="font-bold">
                        INITIAL{" "}
                        <span className="inline-block min-w-[3em] border-b border-black text-center font-normal">
                            {order.dropShipInitials}
                        </span>
                    </span>
                </p>
                <p>
                    <span className="font-bold underline">Advisory:</span> Customer acknowledges and
                    understands that this is a sanctioned fundraising event with a portion of the
                    proceeds allocated directly to the above mentioned organization and therefore,{" "}
                    <span className="font-bold underline">
                        ALL SALES AND TRANSACTIONS ARE FINAL
                    </span>
                    .{" "}
                    <span className="font-bold">
                        INITIAL{" "}
                        <span className="inline-block min-w-[3em] border-b border-black text-center font-normal">
                            {order.advisoryInitials}
                        </span>
                    </span>
                </p>
            </div>

            {/* Signature row */}
            <table className="mt-1 w-full border-collapse text-[10px]">
                <tbody>
                    <tr>
                        <td className={`${cell} relative h-[34px] w-[45%]`}>
                            <span className={label}>Customer Signature:</span>
                            {order.customerSignature && (
                                <img
                                    src={order.customerSignature}
                                    alt=""
                                    className="absolute inset-y-0 right-1 my-auto h-[32px] object-contain"
                                />
                            )}
                        </td>
                        <td className={`${cell} h-[34px] w-[35%]`}>
                            <span className={label}>Customer Name:</span>{" "}
                            <span className="text-[11px]">{order.customerSignatureName}</span>
                        </td>
                        <td className={`${cell} h-[34px]`}>
                            <span className={label}>Date:</span>{" "}
                            <span className="text-[11px]">{FormatStampDate(order.signedDate)}</span>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div className="mt-1 flex gap-4 text-[10px]">
                <p className="flex-1">
                    <span className="font-bold uppercase">Received by:</span>{" "}
                    <span className="inline-block min-w-[55%] border-b border-black">&nbsp;</span>
                </p>
                <p className="flex-1">
                    <span className="font-bold">Date:</span>{" "}
                    <span className="inline-block min-w-[60%] border-b border-black">&nbsp;</span>
                </p>
            </div>
        </div>
    );
};

export default ReceiptSheet;
