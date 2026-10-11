import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { createRef, useEffect, useMemo, useState } from "react";
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
import { useAuth } from "../Context/AuthContext";
import { FormatCurrency, FormatShortDate } from "../Lib/ModelHelpers";
import { BuildSalesCsv, DownloadCsv } from "../Lib/SalesExport";
import { PrintSheetsPdf, TryBuildSheetsPdf } from "../Lib/SheetPdf";
import type { SheetRef } from "../Lib/SheetPdf";
import { Toast } from "../Lib/Toast";
import type { DashboardStats } from "../Models/DashboardStats";
import type { Event } from "../Models/Event";
import type { InventoryItem } from "../Models/InventoryItem";
import type { Order } from "../Models/Order";
import { GetStatsForEvent } from "../Services/DashboardServices";
import { EmailEventReport, GetEmailStatus } from "../Services/EmailServices";
import type { EmailStatus } from "../Services/EmailServices";
import { GetEvent } from "../Services/EventServices";
import { GetInventory } from "../Services/InventoryServices";
import { GetSalesSheetsForEvent } from "../Services/OrderServices";

/**
 * Every completed sales sheet for one event, stacked one per printed page, between the stat sheet
 * and the accessory inventory sheet. Print makes a PDF of the whole stack - the same one email
 * sends - and prints it through the system print dialog; Share CSV exports the same sales as a
 * spreadsheet; Email report sends the stack as a single PDF. Admin only - this is the event's
 * paperwork.
 */
const EventSheetsPage = () => {
    const { user } = useAuth();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();

    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
    const [emailing, setEmailing] = useState<boolean>(false);
    const [printProgress, setPrintProgress] = useState<string | null>(null);

    // One ref per page, in print order: the stat sheet, each sales sheet, the inventory sheet.
    const statRef = useMemo<SheetRef>(() => createRef<View>(), []);
    const inventoryRef = useMemo<SheetRef>(() => createRef<View>(), []);
    const orderRefs = useMemo<SheetRef[]>(() => orders.map(() => createRef<View>()), [orders]);

    useEffect(() => {
        const load = async () => {
            const id = Number(eventId);
            if (!id) return setLoading(false);

            const [found, sheets, figures, stock, status] = await Promise.all([
                GetEvent(id),
                GetSalesSheetsForEvent(id),
                GetStatsForEvent(id),
                GetInventory(id),
                GetEmailStatus(),
            ]);
            setEmailStatus(status);
            setSaleEvent(found);
            setOrders(sheets);
            setStats(figures);
            setInventory(stock);
            setLoading(false);
        };

        load();
    }, [eventId]);

    if (!user) return <Redirect href="/unauthorized" />;
    if (loading) return <LoadingPage />;

    const pages: SheetRef[] = [
        ...(orders.length > 0 ? [statRef] : []),
        ...orderRefs,
        ...(inventory.length > 0 ? [inventoryRef] : []),
    ];

    const slug = `${saleEvent?.organization || "event"}`
        .trim()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
    const date = (saleEvent?.eventDate ?? "").slice(0, 10);

    const handleDownload = () => {
        if (orders.length === 0) return Toast.Warning("There are no completed sales to export.");
        DownloadCsv(`${slug}-${date}-sales.csv`, BuildSalesCsv(orders));
    };

    // Printed from the same PDF that email sends, so the sheets come out the same from any device.
    const handlePrint = async () => {
        if (pages.length === 0) return Toast.Warning("There are no completed sales to print.");

        setPrintProgress("Making the PDF...");
        await PrintSheetsPdf(pages, (page, total) =>
            setPrintProgress(`Making the PDF: ${page} of ${total}...`)
        );
        setPrintProgress(null);
    };

    const handleEmail = () => {
        if (!emailStatus?.configured)
            return Toast.Warning(
                "Email isn't set up on this server yet. Ask whoever runs the app to add the email settings."
            );
        if (pages.length === 0) return Toast.Warning("There are no completed sales to report yet.");
        setEmailing(true);
    };

    const total = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);

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
                            onClick={handleDownload}
                            className="bg-green-700 dark:bg-green-600"
                        />
                        <Button
                            text="Email report"
                            icon="fa-solid fa-envelope"
                            onClick={handleEmail}
                            className="bg-zinc-600 dark:bg-zinc-600"
                        />
                        <Button
                            text={printProgress ?? "Print"}
                            icon="fa-solid fa-print"
                            onClick={handlePrint}
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
                        <Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            The stat sheet prints first, then each sales sheet on its own page, then
                            the accessory inventory sheet. Email report sends the same pages as one
                            PDF.
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
                                        onSaved={(notes) =>
                                            setSaleEvent((current) =>
                                                current ? { ...current, inventoryNotes: notes } : current
                                            )
                                        }
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
                    onSend={async (to, message, report) => {
                        const pdf = await TryBuildSheetsPdf(pages, (page, count) =>
                            report(`Making the PDF: page ${page} of ${count}...`)
                        );
                        if (!pdf) return null;
                        report("Sending...");
                        return EmailEventReport(saleEvent.id!, to, message, pdf);
                    }}
                    onClose={() => setEmailing(false)}
                />
            )}
        </View>
    );
};

export default EventSheetsPage;
