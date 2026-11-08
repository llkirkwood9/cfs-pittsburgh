import { Fragment } from "react";
import type { CSSProperties } from "react";
import { FormatCurrency, FormatShortDate, FormatStampDate } from "@shared/Lib/Format";
import { PrintedInitials } from "@shared/Lib/Orders";
import { MIN_ITEM_ROWS, ROW_PX, ReceiptModel } from "@shared/Lib/Receipt";
import TermText from "../Elements/TermText";
import { ChoicesText, LineDiscountText, LineHasDiscount } from "@shared/Lib/Pricing";
import { useSettingsFor } from "@shared/Context/SettingsContext";
import { DefaultSalesTerms } from "@shared/Models/GeneralSettings";
import type { SalesTermKey } from "@shared/Models/GeneralSettings";
import type { Order } from "@shared/Models/Order";

type Props = {
    order: Order;
};

/** Roughly how tall a sheet prints with the standard grid, in CSS pixels. */
const SHEET_PX = 940;

/** Roughly how many characters of the 9px terms text fit on one printed line, and its height. */
const TERMS_CHARS_PER_LINE = 190;
const TERMS_LINE_PX = 11.25;

/** How long the standard terms are, so only extra wording counts towards scaling the sheet. */
const DEFAULT_TERMS_CHARS = DefaultSalesTerms.reduce(
    (sum, t) => sum + t.heading.length + t.text.length,
    0
);

const cell = "border border-black px-1 py-[3px] align-top";

const label = "text-[8px] font-bold uppercase leading-none";

/**
 * Pixel-for-pixel a copy of the CFS sales sheet, rendered for the printer. Everything here is
 * black on white with hard borders because it is photocopied and filed, not read on a screen.
 */
const ReceiptSheet = ({ order }: Props) => {
    // The business details of the territory the sale was taken in.
    const settings = useSettingsFor(order.territoryId);
    const {
        terms,
        term,
        lines,
        notice,
        blanks,
        rows,
        rowPx,
        compact,
        rowFont,
        salesName,
        checkoutName,
        showCheckout,
        financing,
        paymentRows,
    } = ReceiptModel(order, settings.terms);

    // A sheet always prints on one page. Past what shorter rows can absorb, the whole sheet is
    // scaled down on paper. Longer terms than the paper form's push the sheet down too.
    const gridBudget = MIN_ITEM_ROWS * ROW_PX;
    const termsChars = terms.reduce((sum, t) => sum + t.heading.length + t.text.length, 0);
    const termsPx =
        Math.max(0, Math.ceil((termsChars - DEFAULT_TERMS_CHARS) / TERMS_CHARS_PER_LINE)) *
        TERMS_LINE_PX;
    const overflowPx = Math.max(0, rows * rowPx - gridBudget) + termsPx;
    const printZoom = overflowPx > 0 ? SHEET_PX / (SHEET_PX + overflowPx) : 1;
    const rowStyle = { height: rowPx, fontSize: rowFont, lineHeight: 1.1 };
    const itemCell = compact ? "border border-black px-1 py-0 align-middle" : cell;

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
                    <span className="rotate-[-30deg] select-none whitespace-nowrap text-[64px] font-black tracking-widest text-red-600/20">
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
                {term("customerInfo").heading && (
                    <>
                        <span className="font-bold underline">
                            {term("customerInfo").heading}:
                        </span>{" "}
                    </>
                )}
                <TermText text={term("customerInfo").text} />{" "}
                <span className="font-bold">
                    INITIAL{" "}
                    <span className="inline-block min-w-[3em] border-b border-black text-center font-normal">
                        {PrintedInitials(order, "customerInfo")}
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
                                    {line.lineType === "Upcharge" && (
                                        <span className="text-[8px] font-bold uppercase">
                                            Upcharge:{" "}
                                        </span>
                                    )}
                                    {line.description}
                                    {ChoicesText(line.choices) && (
                                        <span className="font-semibold">
                                            {" "}
                                            - {ChoicesText(line.choices)}
                                        </span>
                                    )}
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
                                    {/* A catalog sale and the rep's own discount both show, e.g. "20% + $100". */}
                                    {LineDiscountText(line)}
                                </td>
                                <td className={`${itemCell} text-right`}>
                                    {LineHasDiscount(line) ? FormatCurrency(line.salePrice) : ""}
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
                    {paymentRows.map((row, index) => (
                        <tr key={row.method}>
                            {index === 0 && (
                                <td
                                    className={`${cell} align-top text-[11px]`}
                                    rowSpan={paymentRows.length}
                                >
                                    {order.comments}
                                    {financing.map((line, lineIndex) => (
                                        <div key={lineIndex} className="font-semibold">
                                            {line}
                                        </div>
                                    ))}
                                </td>
                            )}
                            <td className={`${cell} text-center font-semibold`}>{row.method}</td>
                            <td className={`${cell} text-right`}>{row.amount}</td>
                            {row.totalLabel ? (
                                <>
                                    <td
                                        className={`${cell} ${row.totalLabel === "CC Processing Fee" ? "text-[9px] " : ""}font-semibold`}
                                    >
                                        {row.totalLabel}
                                    </td>
                                    <td
                                        className={`${cell} text-right${row.bold ? " font-bold" : ""}`}
                                    >
                                        {row.total}
                                    </td>
                                </>
                            ) : (
                                <td className={cell} colSpan={2}>
                                    &nbsp;
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Acknowledgements: the wording set under Settings, or the copy kept with a completed sale */}
            <div className="mt-2 space-y-1 font-serif text-[9px] leading-tight">
                {(
                    [
                        ["warranty", PrintedInitials(order, "warranty")],
                        ["dropShip", PrintedInitials(order, "dropShip")],
                        ["advisory", PrintedInitials(order, "advisory")],
                    ] as [SalesTermKey, string | null | undefined][]
                ).map(([key, initials]) => (
                    <p key={key}>
                        {term(key).heading && (
                            <>
                                <span className="font-bold underline">
                                    {term(key).heading}:
                                </span>{" "}
                            </>
                        )}
                        <TermText text={term(key).text} />{" "}
                        <span className="font-bold">
                            INITIAL{" "}
                            <span className="inline-block min-w-[3em] border-b border-black text-center font-normal">
                                {initials}
                            </span>
                        </span>
                    </p>
                ))}
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
