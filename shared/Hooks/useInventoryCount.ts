import { useEffect, useMemo, useState } from "react";
import { Toast } from "@host";
import { useAuth } from "../Context/AuthContext";
import { GroupInventory, InventoryRowKey } from "../Lib/Inventory";
import {
    CountPhaseCopy,
    CountProgressOf,
    ParseCount,
    PreviousCounts,
    SaveCountMessage,
} from "../Lib/InventoryCount";
import type { CountPhase } from "../Lib/InventoryCount";
import type { Event } from "../Models/Event";
import type { InventoryItem } from "../Models/InventoryItem";
import { GetActiveEvent } from "../Services/EventServices";
import { GetInventory, SaveInventoryCount } from "../Services/InventoryServices";

/**
 * A shelf count for the active event: the sizes, what has been entered, and saving it.
 * @param phase Which count.
 * @returns The screen's state and handlers.
 */
export const useInventoryCount = (phase: CountPhase) => {
    const { hasRole } = useAuth();
    const text = CountPhaseCopy[phase];

    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [counts, setCounts] = useState<Record<string, string>>({});
    const [note, setNote] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [confirming, setConfirming] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const active = await GetActiveEvent();
            setSaleEvent(active ?? null);
            if (active?.id) {
                const rows = (await GetInventory(active.id)) ?? [];
                setItems(rows);
                setCounts(PreviousCounts(rows, phase));
            }
            setLoading(false);
        };
        load();
    }, [phase]);

    const groups = useMemo(() => GroupInventory(items), [items]);
    const progress = CountProgressOf(items, counts);
    const { entered, invalid, differences } = progress;

    /**
     * Enters a size's count, keeping only digits.
     * @param item The size.
     * @param value What was typed.
     */
    const setCount = (item: InventoryItem, value: string) =>
        setCounts((current) => ({
            ...current,
            [InventoryRowKey(item)]: value.replace(/[^0-9]/g, ""),
        }));

    // Fills every size not yet counted with what the app expects - for the common case where the
    // shelf agrees and only a few sizes need a real number.
    const fillBlanks = () =>
        setCounts((current) => {
            const next = { ...current };
            for (const item of items) {
                const id = InventoryRowKey(item);
                if (ParseCount(next[id]) === null) next[id] = String(item.quantityOnHand ?? 0);
            }
            return next;
        });

    /** Checks the count, then asks before saving. */
    const review = () => {
        if (invalid) return Toast.Warning("Counts must be whole numbers, 0 or more.");
        if (entered.length === 0) return Toast.Warning("Enter at least one count.");
        setConfirming(true);
    };

    /**
     * Saves the count against the event.
     * @param onSaved Called once it's saved, to leave the screen.
     */
    const save = async (onSaved: () => void) => {
        if (!saleEvent?.id) return;

        setSaving(true);
        const result = await SaveInventoryCount({
            eventId: saleEvent.id,
            phase: phase === "start" ? "Start" : "End",
            note: note.trim() || undefined,
            counts: entered.map((i) => ({
                productVariantId: i.productVariantId ?? 0,
                stockKey: i.stockKey,
                counted: ParseCount(counts[InventoryRowKey(i)]) ?? 0,
            })),
        });
        setSaving(false);
        setConfirming(false);

        if (!result) return;
        Toast.Success(
            `${text.saved} for ${entered.length} size${entered.length === 1 ? "" : "s"}.` +
                (differences.length ? ` ${differences.length} updated to match the shelf.` : "")
        );
        onSaved();
    };

    return {
        text,
        saleEvent,
        items,
        groups,
        counts,
        /** A size's count as entered, or null. */
        countFor: (item: InventoryItem) => ParseCount(counts[InventoryRowKey(item)]),
        setCount,
        fillBlanks,
        note,
        setNote,
        loading,
        progress,
        review,
        confirming,
        setConfirming,
        /** What the save confirmation says. */
        confirmMessage: SaveCountMessage(progress, items.length, hasRole("Manager")),
        saving,
        save,
    };
};
