import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "../Components/Elements/Button";
import EmailDialog from "../Components/Elements/EmailDialog";
import Icon from "../Components/Elements/Icon";
import LoadingPage from "../Components/Elements/LoadingPage";
import ReceiptSheet from "../Components/Checkout/ReceiptSheet";
import StatSheet from "../Components/Dashboard/StatSheet";
import InventoryNotesEditor from "../Components/Inventory/InventoryNotesEditor";
import InventorySheet from "../Components/Inventory/InventorySheet";
import { useAuth } from "../Context/AuthContext";
import { FormatCurrency, FormatShortDate } from "../Lib/ModelHelpers";
import { BuildSalesCsv, DownloadCsv } from "../Lib/SalesExport";
import { FindSheets, TryBuildSheetsPdf } from "../Lib/SheetPdf";
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
 * and the accessory inventory sheet. Print sends the whole
 * stack to the printer, or to a PDF via the browser's Save as PDF; Download CSV exports the same
 * sales as a spreadsheet; Email report sends the same stack of sheets as a single PDF. Admin only -
 * this is the event's paperwork.
 */
const EventSheetsPage = () => {
    const { user } = useAuth();
    const { eventId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
    const [emailing, setEmailing] = useState<boolean>(false);
    const sheetsRef = useRef<HTMLDivElement>(null);

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

    if (!user) return <Navigate to="/unauthorized" replace />;
    if (loading) return <LoadingPage />;

    const from = (location.state as { from?: string; label?: string } | null) ?? null;
    const goBack = () => navigate(from?.from ?? "/events");

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

    const handlePrint = () => {
        if (orders.length === 0 && inventory.length === 0)
            return Toast.Warning("There are no completed sales to print.");

        // The browser uses the page title as the suggested PDF file name.
        const previous = document.title;
        document.title = `${slug}-${date}-sales-sheets`;
        window.print();
        document.title = previous;
    };

    const handleEmail = () => {
        if (!emailStatus?.configured)
            return Toast.Warning(
                "Email isn't set up on this server yet. Ask whoever runs the app to add the email settings."
            );
        if (orders.length === 0 && inventory.length === 0)
            return Toast.Warning("There are no completed sales to report yet.");
        setEmailing(true);
    };

    const total = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);

    return (
        <div className="print-root min-h-screen bg-zinc-200 py-4 dark:bg-zinc-900">
            <div className="no-print mx-auto mb-4 max-w-[8in] px-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        text={from?.label ?? "Back to events"}
                        icon="fa-solid fa-arrow-left"
                        onClick={goBack}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                    <div className="ml-auto flex flex-wrap gap-2">
                        <Button
                            text="Download CSV"
                            icon="fa-solid fa-file-csv"
                            onClick={handleDownload}
                            className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                        />
                        <Button
                            text="Email report"
                            icon="fa-solid fa-envelope"
                            onClick={handleEmail}
                            className="bg-zinc-600 hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                        <Button
                            text="Print / Save PDF"
                            icon="fa-solid fa-print"
                            onClick={handlePrint}
                        />
                    </div>
                </div>

                <div className="mt-3 rounded-xl bg-white p-4 text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100">
                    <h1 className="text-lg font-bold">{saleEvent?.organization}</h1>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {FormatShortDate(saleEvent?.eventDate)} &middot; {orders.length} completed
                        sale
                        {orders.length === 1 ? "" : "s"} &middot; {FormatCurrency(total)}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        The stat sheet prints first, then each sales sheet on its own page, then the
                        accessory inventory sheet. To save a PDF, choose Save as PDF as the printer.
                    </p>
                </div>
            </div>

            {orders.length === 0 && inventory.length === 0 ? (
                <div className="no-print mx-auto max-w-[8in] px-3">
                    <div className="rounded-xl border-2 border-dashed border-zinc-400 py-14 text-center dark:border-zinc-700">
                        <Icon icon="fa-solid fa-inbox" className="text-3xl text-zinc-400" />
                        <p className="mt-3 text-base font-semibold text-zinc-700 dark:text-zinc-200">
                            No completed sales for this event yet
                        </p>
                    </div>
                </div>
            ) : (
                <div ref={sheetsRef}>
                    {orders.length > 0 && (
                        <div className="mb-6 break-after-page print:mb-0">
                            {/* The paper layouts have a minimum width; on a small phone they scroll sideways on
                                their own rather than widening the whole page. */}
                            <div className="overflow-x-auto print:overflow-visible">
                                <StatSheet saleEvent={saleEvent} stats={stats} orders={orders} />
                            </div>
                        </div>
                    )}
                    {orders.map((order, index) => (
                        <div
                            key={order.id}
                            className={`mb-6 print:mb-0 ${
                                index < orders.length - 1 || inventory.length > 0
                                    ? "break-after-page"
                                    : ""
                            }`}
                        >
                            <div className="overflow-x-auto print:overflow-visible">
                                <ReceiptSheet order={order} />
                            </div>
                        </div>
                    ))}
                    {/* The inventory sheet closes the stack, as the paper tally did. */}
                    {inventory.length > 0 && (
                        <div className="mb-6 print:mb-0">
                            {saleEvent?.id && (
                                <div className="no-print mx-auto mb-3 max-w-[8in] px-3">
                                    <InventoryNotesEditor
                                        eventId={saleEvent.id}
                                        notes={saleEvent.inventoryNotes}
                                        onSaved={(notes) =>
                                            setSaleEvent((current) =>
                                                current
                                                    ? { ...current, inventoryNotes: notes }
                                                    : current
                                            )
                                        }
                                    />
                                </div>
                            )}
                            <div className="overflow-x-auto print:overflow-visible">
                                <InventorySheet saleEvent={saleEvent} items={inventory} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {emailing && saleEvent?.id && (
                <EmailDialog
                    title="Email the event report"
                    description={
                        <>
                            Sends {saleEvent.organization}&apos;s sheets as a single PDF: the stat
                            sheet, {orders.length} completed sales sheet
                            {orders.length === 1 ? "" : "s"}
                            {inventory.length > 0 ? " and the accessory inventory sheet" : ""}.
                        </>
                    }
                    withMessage
                    onSend={async (to, message, progress) => {
                        const pdf = await TryBuildSheetsPdf(
                            FindSheets(sheetsRef.current),
                            (page, total) => progress(`Making the PDF: page ${page} of ${total}...`)
                        );
                        if (!pdf) return null;
                        progress("Sending...");
                        return EmailEventReport(saleEvent.id!, to, message, pdf);
                    }}
                    onClose={() => setEmailing(false)}
                />
            )}
        </div>
    );
};

export default EventSheetsPage;
