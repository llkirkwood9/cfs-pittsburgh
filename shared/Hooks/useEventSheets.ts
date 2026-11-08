import { useEffect, useState } from "react";
import type { DashboardStats } from "../Models/DashboardStats";
import type { Event } from "../Models/Event";
import type { InventoryItem } from "../Models/InventoryItem";
import type { Order } from "../Models/Order";
import { GetStatsForEvent } from "../Services/DashboardServices";
import { GetEmailStatus } from "../Services/EmailServices";
import type { EmailStatus } from "../Services/EmailServices";
import { GetEvent } from "../Services/EventServices";
import { GetInventory } from "../Services/InventoryServices";
import { GetSalesSheetsForEvent } from "../Services/OrderServices";

/**
 * Everything an event's printed paperwork needs: the event, its completed sales sheets, its
 * figures and stock, and whether email is set up to send them.
 * @param eventId The event's id.
 * @returns The data, and a way to keep the event's inventory notes once saved.
 */
export const useEventSheets = (eventId: number) => {
    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);

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
            setOrders(sheets);
            setStats(figures);
            setInventory(stock);
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

    return { saleEvent, orders, stats, inventory, loading, emailStatus, notesSaved };
};
