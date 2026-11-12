import { useEffect, useState } from "react";
import { DownloadCsv, Toast } from "@host";
import { EMAIL_NOT_SET_UP } from "../Lib/Email";
import { BuildSalesCsv, EventFileBase } from "../Lib/SalesCsv";
import { EmailSheets, PrintSheetsPdf } from "../Lib/SheetPdf";
import type { Sheet } from "../Lib/SheetPdf";
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
 * Everything an event's printed paperwork needs: the event, its completed sales sheets, its
 * figures and stock, and whether email is set up to send them - and the CSV, print and email
 * buttons. Print and email use the same PDF of the whole stack, so the sheets come out the same
 * from any device.
 * @param eventId The event's id.
 * @returns The data, the button handlers, and a way to keep the event's inventory notes once saved.
 */
export const useEventSheets = (eventId: number) => {
    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
    const [emailing, setEmailing] = useState<boolean>(false);
    const [printProgress, setPrintProgress] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            if (!eventId) return setLoading(false);

            const [found, sheets, figures, stock, status] = await Promise.all([
                GetEvent(eventId),
                GetSalesSheetsForEvent(eventId),
                GetStatsForEvent(eventId),
                GetInventory(eventId),
                GetEmailStatus(),
            ]);
            setEmailStatus(status);
            setSaleEvent(found);
            setOrders(sheets ?? []);
            setStats(figures);
            setInventory(stock ?? []);
            setLoading(false);
        };

        load();
    }, [eventId]);

    /**
     * Keeps the event's inventory notes once they're saved.
     * @param notes The notes.
     */
    const notesSaved = (notes: string | null) =>
        setSaleEvent((current) => (current ? { ...current, inventoryNotes: notes } : current));

    const fileBase = EventFileBase(saleEvent);
    // The stack is the stat sheet and the sales sheets when anything sold, and the inventory sheet
    // when anything is tracked.
    const hasSheets = orders.length > 0 || inventory.length > 0;

    const downloadCsv = async () => {
        if (orders.length === 0) return Toast.Warning("There are no completed sales to export.");
        await DownloadCsv(`${fileBase}-sales.csv`, BuildSalesCsv(orders));
    };

    /**
     * Prints the stack. Call it straight from the tap.
     * @param sheets The sheets on screen, in page order.
     */
    const print = async (sheets: Sheet[]) => {
        if (!hasSheets) return Toast.Warning("There are no completed sales to print.");
        setPrintProgress("Making the PDF...");
        await PrintSheetsPdf(sheets, `${fileBase}-sales-sheets`, (page, total) =>
            setPrintProgress(`Making the PDF: ${page} of ${total}...`)
        );
        setPrintProgress(null);
    };

    const startEmail = () => {
        if (!emailStatus?.configured) return Toast.Warning(EMAIL_NOT_SET_UP);
        if (!hasSheets) return Toast.Warning("There are no completed sales to report yet.");
        setEmailing(true);
    };

    /**
     * Sends the stack as one PDF, from the email dialog.
     * @param sheets The sheets on screen, in page order.
     * @param to The addresses.
     * @param message The message with the report.
     * @param progress Told what it is doing.
     * @returns The addresses it went to, or null when it failed.
     */
    const sendReport = async (
        sheets: Sheet[],
        to: string,
        message: string,
        progress: (status: string) => void
    ) => {
        const id = saleEvent?.id;
        if (!id) return null;
        return EmailSheets(`event:${id}`, sheets, progress, (uploadId) =>
            EmailEventReport(id, to, message, uploadId)
        );
    };

    return {
        saleEvent,
        orders,
        stats,
        inventory,
        loading,
        notesSaved,
        /** Every completed sale's total, added up. */
        total: orders.reduce((sum, o) => sum + (o.total ?? 0), 0),
        downloadCsv,
        print,
        /** What printing is doing, or null when it isn't. */
        printProgress,
        emailing,
        startEmail,
        stopEmail: () => setEmailing(false),
        sendReport,
    };
};
