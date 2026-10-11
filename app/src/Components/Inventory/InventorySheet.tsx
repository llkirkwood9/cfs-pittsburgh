import { Fragment } from "react";
import type { Ref } from "react";
import { View } from "react-native";
import type { DimensionValue } from "react-native";
import { Cell, Row, SheetText } from "../Checkout/SheetTable";
import {
    CategoryNames,
    FormatShortDate,
    GroupInventory,
    InventoryRowKey,
    InventorySizeLabel,
} from "../../Lib/ModelHelpers";
import { SHEET_WIDTH } from "../../Lib/SheetPdf";
import type { Event } from "../../Models/Event";
import type { InventoryItem } from "../../Models/InventoryItem";

type Props = {
    saleEvent: Event | null;
    items: InventoryItem[];
    /** The sheet itself, for capturing into a PDF. */
    sheetRef?: Ref<View>;
};

/**
 * The columns' widths in percent of the table, as on the paper sheet; Difference takes what is
 * left. The item column spans each product's sizes, so the size rows beside it are laid out in
 * the remaining width.
 */
const ITEM = 28;
const COLUMNS: { label: string; width: number; center: boolean }[] = [
    { label: "Size", width: 14, center: false },
    { label: "Start", width: 10, center: true },
    { label: "Take With sold", width: 12, center: true },
    { label: "Expected", width: 12, center: true },
    { label: "Counted", width: 12, center: true },
];

/** A column's width within the size rows beside the item column. */
const inner = (width: number): DimensionValue => `${(width / (100 - ITEM)) * 100}%`;

const HEAD = { backgroundColor: "#f4f4f5" };

/**
 * The Accessory Inventory Sheet, filled in. Laid out like the paper sheet the crew tallies at the
 * end of an event: each tracked accessory by size, with what the start-of-event count found, what
 * went home as Take With, what the app expected to be left, and what the end-of-event count found
 * - or a blank column to write the count in by hand when it has not been done in the app. Printed
 * as the last page of an event's sheets.
 */
const InventorySheet = ({ saleEvent, items, sheetRef }: Props) => {
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

    const headCell = (label: string, width: DimensionValue | undefined, center: boolean) => (
        <Cell key={label} width={width} flex={width ? undefined : 1} align={center ? "center" : "left"} style={HEAD}>
            <SheetText size={10} bold style={{ textTransform: "uppercase" }}>
                {label}
            </SheetText>
        </Cell>
    );

    const valueCell = (value: string | number, width: DimensionValue | undefined, bold = false) => (
        <Cell width={width} flex={width ? undefined : 1} align="center" middle>
            <SheetText size={11} bold={bold}>
                {value}
            </SheetText>
        </Cell>
    );

    return (
        <View
            ref={sheetRef}
            collapsable={false}
            style={{ width: SHEET_WIDTH, backgroundColor: "#fff", padding: 32, overflow: "hidden" }}
        >
            <SheetText size={20} bold align="center">
                Accessory Inventory Sheet
            </SheetText>
            <SheetText size={12} align="center" style={{ marginTop: 4 }}>
                At the end of the event, please tally the accessories below. Thank you!
            </SheetText>

            <View style={{ marginTop: 20, gap: 2 }}>
                {[
                    ["Event", saleEvent?.organization],
                    ["Cart", saleEvent?.cartName],
                    ["Date", FormatShortDate(saleEvent?.eventDate)],
                ].map(([label, value]) => (
                    <SheetText key={label} size={13} bold>
                        {label}: <SheetText size={13}>{value ?? ""}</SheetText>
                    </SheetText>
                ))}
            </View>

            {groups.length === 0 ? (
                <SheetText size={12} italic style={{ marginTop: 24 }}>
                    No products are set to track inventory. An administrator can turn on Track
                    inventory for a product in the Catalog.
                </SheetText>
            ) : (
                groups.map((group) => (
                    <View key={group.category} style={{ marginTop: 20 }}>
                        <SheetText size={14} bold style={{ marginBottom: 4 }}>
                            {CategoryNames[group.category]}
                        </SheetText>

                        <Row>
                            {headCell("Item", `${ITEM}%`, false)}
                            {COLUMNS.map((c) => headCell(c.label, `${c.width}%`, c.center))}
                            {headCell("Difference", undefined, true)}
                        </Row>

                        {group.products.map((product) => (
                            <Row key={product.productId}>
                                {/* The item spans its sizes, like a table cell's rowspan. */}
                                <Cell width={`${ITEM}%`}>
                                    <SheetText size={11} semibold style={{ textTransform: "uppercase" }}>
                                        {product.name}
                                    </SheetText>
                                    {product.brand ? (
                                        <SheetText size={9} color="#52525b">
                                            {product.brand}
                                        </SheetText>
                                    ) : null}
                                </Cell>
                                <View style={{ flex: 1, marginLeft: -1 }}>
                                    {product.sizes.map((size) => (
                                        <Fragment key={InventoryRowKey(size)}>
                                            <Row style={{ flexGrow: 1 }}>
                                                <Cell width={inner(COLUMNS[0].width)} middle>
                                                    <SheetText size={11} semibold style={{ textTransform: "uppercase" }}>
                                                        {InventorySizeLabel(size)}
                                                    </SheetText>
                                                </Cell>
                                                {valueCell(size.openingCountAtEvent ?? "", inner(COLUMNS[1].width))}
                                                {valueCell(size.soldAtEvent ?? 0, inner(COLUMNS[2].width))}
                                                {valueCell(expectedFor(size), inner(COLUMNS[3].width))}
                                                {valueCell(size.countedAtEvent ?? "", inner(COLUMNS[4].width), true)}
                                                {valueCell(differenceFor(size), undefined)}
                                            </Row>
                                        </Fragment>
                                    ))}
                                </View>
                            </Row>
                        ))}
                    </View>
                ))
            )}

            <View style={{ marginTop: 24 }}>
                <SheetText size={12} bold>
                    Notes:
                </SheetText>
                {saleEvent?.inventoryNotes ? (
                    <View style={{ marginTop: 4, borderBottomWidth: 1, borderColor: "#000", paddingBottom: 4 }}>
                        <SheetText size={12}>{saleEvent.inventoryNotes}</SheetText>
                    </View>
                ) : null}
                {/* Ruled lines are left under any typed notes for the crew to add to by hand. */}
                {Array.from({ length: saleEvent?.inventoryNotes ? 2 : 3 }).map((_, index) => (
                    <View key={index} style={{ height: 36, borderBottomWidth: 1, borderColor: "#000" }} />
                ))}
            </View>
        </View>
    );
};

export default InventorySheet;
