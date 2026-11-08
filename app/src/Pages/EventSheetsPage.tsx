import { Stack, useLocalSearchParams } from "expo-router";
import { createRef, useMemo } from "react";
import { ScrollView, View } from "react-native";
import ReceiptSheet from "../Components/Checkout/ReceiptSheet";
import SheetViewer from "../Components/Checkout/SheetViewer";
import StatSheet from "../Components/Dashboard/StatSheet";
import Button from "../Components/Elements/Button";
import EmailDialog from "../Components/Elements/EmailDialog";
import Icon from "../Components/Elements/Icon";
import LoadingPage from "../Components/Elements/LoadingPage";
import Text from "../Components/Elements/Text";
import InventoryNotesEditor from "../Components/Inventory/InventoryNotesEditor";
import InventorySheet from "../Components/Inventory/InventorySheet";
import { FormatCurrency, FormatShortDate } from "@shared/Lib/Format";
import { useEventSheets } from "@shared/Hooks/useEventSheets";
import type { SheetRef } from "../Lib/SheetPdf";

/**
 * Every completed sales sheet for one event, stacked one per printed page, between the stat sheet
 * and the accessory inventory sheet. Print makes a PDF of the whole stack - the same one email
 * sends - and prints it through the system print dialog; Share CSV exports the same sales as a
 * spreadsheet; Email report sends the stack as a single PDF. Admin only - this is the event's
 * paperwork.
 */
const EventSheetsPage = () => {
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const {
        saleEvent,
        orders,
        stats,
        inventory,
        loading,
        notesSaved,
        total,
        downloadCsv,
        print,
        printProgress,
        emailing,
        startEmail,
        stopEmail,
        sendReport,
    } = useEventSheets(Number(eventId));

    // One ref per page, in print order: the stat sheet, each sales sheet, the inventory sheet.
    const statRef = useMemo<SheetRef>(() => createRef<View>(), []);
    const inventoryRef = useMemo<SheetRef>(() => createRef<View>(), []);
    const orderRefs = useMemo<SheetRef[]>(() => orders.map(() => createRef<View>()), [orders]);

    if (loading) return <LoadingPage />;

    const pages: SheetRef[] = [
        ...(orders.length > 0 ? [statRef] : []),
        ...orderRefs,
        ...(inventory.length > 0 ? [inventoryRef] : []),
    ];

    return (
        <View className="flex-1 bg-zinc-200 dark:bg-zinc-900">
            <Stack.Screen options={{ title: saleEvent?.organization ?? "Event sheets" }} />

            <ScrollView
                className="flex-1"
                contentContainerClassName="items-center px-3 pb-10"
                maximumZoomScale={3}
                minimumZoomScale={1}
            >
                <View className="w-full max-w-3xl py-3">
                    <View className="flex-row flex-wrap justify-end gap-2">
                        <Button
                            text="Share CSV"
                            icon="fa-solid fa-file-csv"
                            onClick={downloadCsv}
                            className="bg-green-700 dark:bg-green-600"
                        />
                        <Button
                            text="Email report"
                            icon="fa-solid fa-envelope"
                            onClick={startEmail}
                            className="bg-zinc-600 dark:bg-zinc-600"
                        />
                        <Button
                            text={printProgress ?? "Print"}
                            icon="fa-solid fa-print"
                            onClick={() => print(pages)}
                            loading={printProgress !== null}
                            disabled={printProgress !== null}
                        />
                    </View>

                    <View className="mt-3 rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
                        <Text className="text-lg font-bold">{saleEvent?.organization}</Text>
                        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                            {FormatShortDate(saleEvent?.eventDate)} · {orders.length} completed sale
                            {orders.length === 1 ? "" : "s"} · {FormatCurrency(total)}
                        </Text>
                    </View>
                </View>

                {pages.length === 0 ? (
                    <View className="w-full max-w-3xl items-center rounded-xl border-2 border-dashed border-zinc-400 py-14 dark:border-zinc-700">
                        <Icon icon="fa-solid fa-inbox" className="text-3xl text-zinc-400" />
                        <Text className="mt-3 text-base font-semibold text-zinc-700 dark:text-zinc-200">
                            No completed sales for this event yet
                        </Text>
                    </View>
                ) : (
                    <View className="w-full items-center gap-6">
                        {orders.length > 0 && (
                            <SheetViewer>
                                <StatSheet
                                    saleEvent={saleEvent}
                                    stats={stats}
                                    orders={orders}
                                    sheetRef={statRef}
                                />
                            </SheetViewer>
                        )}
                        {orders.map((order, index) => (
                            <SheetViewer key={order.id}>
                                <ReceiptSheet order={order} sheetRef={orderRefs[index]} />
                            </SheetViewer>
                        ))}
                        {/* The inventory sheet closes the stack, as the paper tally did. */}
                        {inventory.length > 0 && (
                            <View className="w-full items-center gap-3">
                                {saleEvent?.id && (
                                    <InventoryNotesEditor
                                        eventId={saleEvent.id}
                                        notes={saleEvent.inventoryNotes}
                                        onSaved={notesSaved}
                                        className="w-full max-w-3xl"
                                    />
                                )}
                                <SheetViewer>
                                    <InventorySheet
                                        saleEvent={saleEvent}
                                        items={inventory}
                                        sheetRef={inventoryRef}
                                    />
                                </SheetViewer>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {emailing && saleEvent?.id && (
                <EmailDialog
                    title="Email the event report"
                    description={`Sends ${saleEvent.organization}'s sheets as a single PDF: the stat sheet, ${
                        orders.length
                    } completed sales sheet${orders.length === 1 ? "" : "s"}${
                        inventory.length > 0 ? " and the accessory inventory sheet" : ""
                    }.`}
                    withMessage
                    onSend={(to, message, progress) => sendReport(pages, to, message, progress)}
                    onClose={stopEmail}
                />
            )}
        </View>
    );
};

export default EventSheetsPage;
