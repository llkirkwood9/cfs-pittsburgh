import {
    CategoryNames,
    FormatShortDate,
    GroupInventory,
    InventorySizeLabel,
} from "../../Lib/ModelHelpers";
import type { Event } from "../../Models/Event";
import type { InventoryItem } from "../../Models/InventoryItem";

type Props = {
    saleEvent: Event | null;
    items: InventoryItem[];
};

const cell = "border border-black px-2 py-[3px] text-[11px]";
const head = `${cell} bg-zinc-100 text-left text-[10px] font-bold uppercase`;

/**
 * The Accessory Inventory Sheet, filled in. Laid out like the paper sheet the crew tallies at the
 * end of an event: each tracked accessory by size, with what the start-of-event count found, what
 * went home as Take With, what the app expected to be left, and what the end-of-event count found - or a blank column to write the
 * count in by hand when it has not been done in the app. Printed as the last page of an event's
 * sheets.
 */
const InventorySheet = ({ saleEvent, items }: Props) => {
    const groups = GroupInventory(items);

    // Once the end-of-event count is saved, Expected is what the app thought was on the shelf at
    // that moment; before it, the current count, with Counted left blank to fill in by hand.
    const counted = (size: InventoryItem) =>
        size.countedAtEvent !== null && size.countedAtEvent !== undefined;
    const expectedFor = (size: InventoryItem) =>
        counted(size) ? (size.expectedAtCount ?? 0) : (size.quantityOnHand ?? 0);
    const differenceFor = (size: InventoryItem) => {
        if (!counted(size)) return "";
        const diff = (size.countedAtEvent ?? 0) - expectedFor(size);
        return diff === 0 ? "0" : diff > 0 ? `+${diff}` : String(diff);
    };

    return (
        <div className="print-sheet mx-auto w-full max-w-[8in] bg-white p-8 font-sans text-black shadow-lg">
            <h1 className="text-center text-xl font-bold">Accessory Inventory Sheet</h1>
            <p className="mt-1 text-center text-[12px]">
                At the end of the event, please tally the accessories below. Thank you!
            </p>

            <div className="mt-5 space-y-0.5 text-[13px] font-bold">
                <p>
                    Event: <span className="font-normal">{saleEvent?.organization}</span>
                </p>
                <p>
                    Cart: <span className="font-normal">{saleEvent?.cartName}</span>
                </p>
                <p>
                    Date:{" "}
                    <span className="font-normal">{FormatShortDate(saleEvent?.eventDate)}</span>
                </p>
            </div>

            {groups.length === 0 ? (
                <p className="mt-6 text-[12px] italic">
                    No products are set to track inventory. An administrator can turn on Track
                    inventory for a product in the Catalog.
                </p>
            ) : (
                groups.map((group) => (
                    <section key={group.category} className="mt-5 break-inside-avoid">
                        <h2 className="mb-1 text-[14px] font-bold">
                            {CategoryNames[group.category]}
                        </h2>
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={`${head} w-[28%]`}>Item</th>
                                    <th className={`${head} w-[14%]`}>Size</th>
                                    <th className={`${head} w-[10%] text-center`}>Start</th>
                                    <th className={`${head} w-[12%] text-center`}>
                                        Take With sold
                                    </th>
                                    <th className={`${head} w-[12%] text-center`}>Expected</th>
                                    <th className={`${head} w-[12%] text-center`}>Counted</th>
                                    <th className={`${head} w-[12%] text-center`}>Difference</th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.products.flatMap((product) =>
                                    product.sizes.map((size, index) => (
                                        <tr key={size.productVariantId}>
                                            {index === 0 && (
                                                <td
                                                    rowSpan={product.sizes.length}
                                                    className={`${cell} align-top font-semibold uppercase`}
                                                >
                                                    {product.name}
                                                    {product.brand && (
                                                        <span className="block text-[9px] font-normal normal-case text-zinc-600">
                                                            {product.brand}
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            <td className={`${cell} font-semibold uppercase`}>
                                                {InventorySizeLabel(size)}
                                            </td>
                                            <td className={`${cell} text-center tabular-nums`}>
                                                {size.openingCountAtEvent ?? ""}
                                            </td>
                                            <td className={`${cell} text-center tabular-nums`}>
                                                {size.soldAtEvent ?? 0}
                                            </td>
                                            <td className={`${cell} text-center tabular-nums`}>
                                                {expectedFor(size)}
                                            </td>
                                            <td
                                                className={`${cell} text-center font-bold tabular-nums`}
                                            >
                                                {size.countedAtEvent ?? ""}
                                            </td>
                                            <td className={`${cell} text-center tabular-nums`}>
                                                {differenceFor(size)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </section>
                ))
            )}

            <div className="mt-6 break-inside-avoid">
                <p className="text-[12px] font-bold">Notes:</p>
                {saleEvent?.inventoryNotes && (
                    <p className="mt-1 whitespace-pre-line border-b border-black pb-1 text-[12px]">
                        {saleEvent.inventoryNotes}
                    </p>
                )}
                {/* Ruled lines are left under any typed notes for the crew to add to by hand. */}
                <div className="mt-1 space-y-5">
                    {Array.from({ length: saleEvent?.inventoryNotes ? 2 : 3 }).map((_, index) => (
                        <div key={index} className="h-4 border-b border-black" />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InventorySheet;
