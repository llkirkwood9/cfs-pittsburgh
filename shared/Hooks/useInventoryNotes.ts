import { useEffect, useState } from "react";
import { Toast } from "@host";
import { SaveInventoryNotes } from "../Services/InventoryServices";

/**
 * The notes printed in the Notes box of an event's Accessory Inventory Sheet: the text being
 * edited, whether it differs from what is saved, and saving it.
 * @param eventId The event.
 * @param notes The saved notes.
 * @param onSaved Called with the notes once saved (null when cleared).
 * @returns The text, its setter, whether it is unsaved, and the save handler.
 */
export const useInventoryNotes = (
    eventId: number,
    notes: string | null | undefined,
    onSaved: (notes: string | null) => void
) => {
    const [value, setValue] = useState<string>(notes ?? "");
    const [saving, setSaving] = useState<boolean>(false);

    // Pick up notes saved elsewhere, e.g. after a refresh.
    useEffect(() => {
        setValue(notes ?? "");
    }, [notes]);

    const dirty = value.trim() !== (notes ?? "").trim();

    const save = async () => {
        setSaving(true);
        const saved = await SaveInventoryNotes(eventId, value.trim());
        setSaving(false);

        if (saved === undefined) return;
        onSaved(saved);
        Toast.Success(saved ? "Inventory sheet notes saved." : "Inventory sheet notes cleared.");
    };

    return { value, setValue, dirty, saving, save };
};
