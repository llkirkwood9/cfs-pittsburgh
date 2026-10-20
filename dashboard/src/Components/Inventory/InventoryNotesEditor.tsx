import { useEffect, useState } from "react";
import Button from "../Elements/Button";
import TextArea from "../Elements/TextArea";
import { Toast } from "../../Lib/Toast";
import { SaveInventoryNotes } from "../../Services/InventoryServices";

type Props = {
    eventId: number;
    notes: string | null | undefined;
    onSaved: (notes: string | null) => void;
    className?: string;
};

/**
 * The notes printed in the Notes box of an event's Accessory Inventory Sheet - a floor sample, a
 * damaged box, anything the tally doesn't explain on its own. Used on the Inventory screen and on
 * the event's printable sheets.
 */
const InventoryNotesEditor = ({ eventId, notes, onSaved, className = "" }: Props) => {
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

    return (
        <div className={`rounded-xl bg-white p-3 shadow-xs dark:bg-zinc-800 ${className}`}>
            <TextArea
                label="Notes for the inventory sheet"
                value={value}
                onChange={setValue}
                placeholder="ex. One pillow kept as a floor sample"
                maxLength={2000}
                rows={3}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Printed in the Notes box of the Accessory Inventory Sheet.
                </p>
                <Button
                    text={dirty ? "Save notes" : "Saved"}
                    icon={dirty ? "fa-solid fa-floppy-disk" : "fa-solid fa-check"}
                    onClick={save}
                    loading={saving}
                    disabled={!dirty}
                    className="min-h-[40px] px-3 text-sm"
                />
            </div>
        </div>
    );
};

export default InventoryNotesEditor;
