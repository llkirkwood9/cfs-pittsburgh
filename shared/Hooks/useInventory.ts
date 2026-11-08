import { useCallback, useEffect, useMemo, useState } from "react";
import { Toast } from "@host";
import {
    FilterInventory,
    GroupInventory,
    InventoryCategories,
    InventoryRowKey,
    InventorySizeLabel,
    InventoryTotals,
    ShelfCounts,
} from "../Lib/Inventory";
import type { Event } from "../Models/Event";
import type { InventoryAdjustment } from "../Models/InventoryAdjustment";
import type { InventoryItem } from "../Models/InventoryItem";
import type { ProductCategory } from "../Models/Product";
import { GetActiveEvent } from "../Services/EventServices";
import { AdjustInventory, GetInventory, GetInventoryHistory } from "../Services/InventoryServices";

/**
 * The Inventory screen: the active event's stock, nudging and counting a size, and its history.
 * @returns The screen's state and handlers.
 */
export const useInventory = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [search, setSearch] = useState<string>("");
    const [tab, setTab] = useState<ProductCategory | "All">("All");
    const [busyId, setBusyId] = useState<string | null>(null);

    const [counting, setCounting] = useState<InventoryItem | null>(null);
    const [countValue, setCountValue] = useState<string>("");
    const [countNote, setCountNote] = useState<string>("");
    const [savingCount, setSavingCount] = useState<boolean>(false);

    const [historyFor, setHistoryFor] = useState<InventoryItem | null>(null);
    const [history, setHistory] = useState<InventoryAdjustment[] | null>(null);

    const load = useCallback(async () => {
        const active = await GetActiveEvent();
        const rows = active === undefined ? null : await GetInventory(active?.id ?? undefined);
        // A refresh that fails keeps what is on screen.
        if (active !== undefined && rows) {
            setSaleEvent(active);
            setItems(rows);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const replace = (updated: InventoryItem) =>
        setItems((current) =>
            current.map((i) =>
                InventoryRowKey(i) === InventoryRowKey(updated)
                    ? {
                          ...i,
                          quantityOnHand: updated.quantityOnHand,
                          lastChangedAt: updated.lastChangedAt,
                      }
                    : i
            )
        );

    /**
     * Adds or removes units of a size.
     * @param item The size.
     * @param change Units to add (negative to remove).
     */
    const nudge = async (item: InventoryItem, change: number) => {
        if (!item.productVariantId) return;
        setBusyId(InventoryRowKey(item));
        const updated = await AdjustInventory({
            productVariantId: item.productVariantId,
            stockKey: item.stockKey,
            change,
        });
        setBusyId(null);
        if (updated) replace(updated);
    };

    /**
     * Opens the count form for a size.
     * @param item The size.
     */
    const openCount = (item: InventoryItem) => {
        setCounting(item);
        setCountValue(String(item.quantityOnHand ?? 0));
        setCountNote("");
    };

    const saveCount = async () => {
        if (!counting?.productVariantId) return;

        const value = Number(countValue);
        if (!Number.isInteger(value) || value < 0)
            return Toast.Warning("Enter the number on hand - a whole number, 0 or more.");

        setSavingCount(true);
        const updated = await AdjustInventory({
            productVariantId: counting.productVariantId,
            stockKey: counting.stockKey,
            setTo: value,
            note: countNote.trim() || undefined,
        });
        setSavingCount(false);

        if (!updated) return;
        replace(updated);
        setCounting(null);
        Toast.Success(`${counting.productName} (${InventorySizeLabel(counting)}) set to ${value}.`);
    };

    /**
     * Opens a size's history.
     * @param item The size.
     */
    const openHistory = async (item: InventoryItem) => {
        if (!item.productVariantId) return;
        setHistoryFor(item);
        setHistory(null);
        setHistory((await GetInventoryHistory(item.productVariantId, item.stockKey)) ?? []);
    };

    const categories = useMemo(() => InventoryCategories(items), [items]);
    const groups = useMemo(
        () => GroupInventory(FilterInventory(items, tab, search)),
        [items, tab, search]
    );

    /**
     * Keeps the event's inventory notes once they're saved.
     * @param notes The notes.
     */
    const notesSaved = (notes: string | null) =>
        setSaleEvent((current) => (current ? { ...current, inventoryNotes: notes } : current));

    return {
        items,
        saleEvent,
        notesSaved,
        loading,
        load,
        search,
        setSearch,
        tab,
        setTab,
        categories,
        groups,
        shelfCounts: ShelfCounts(items),
        ...InventoryTotals(items),
        /** Whether a size is being nudged right now. */
        isBusy: (item: InventoryItem) => busyId === InventoryRowKey(item),
        nudge,
        counting,
        closeCount: () => setCounting(null),
        countValue,
        setCountValue,
        countNote,
        setCountNote,
        savingCount,
        openCount,
        saveCount,
        historyFor,
        closeHistory: () => setHistoryFor(null),
        history,
        openHistory,
    };
};
