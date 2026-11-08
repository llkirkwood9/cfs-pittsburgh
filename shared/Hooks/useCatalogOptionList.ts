import { useState } from "react";
import { Toast } from "@host";
import { MovedIds } from "../Lib/CatalogOptions";
import type { CatalogOptionForm } from "../Lib/CatalogOptions";

/**
 * One of the catalog's option lists (delivery, financing): the option being edited and its form,
 * the one being deleted, and moving one up or down.
 * @param options The options in order.
 * @param form How an option is edited.
 * @param onSave Saves an option.
 * @param onDelete Deletes an option.
 * @param onReorder Takes every option id in the new order.
 * @returns The state and handlers.
 */
export const useCatalogOptionList = <T extends { id?: number }, D>(
    options: T[],
    form: CatalogOptionForm<T, D>,
    onSave: (option: T) => Promise<void>,
    onDelete: (id: number) => Promise<void>,
    onReorder: (ids: number[]) => Promise<void>
) => {
    const [editing, setEditing] = useState<T | null>(null);
    const [draft, setDraft] = useState<D>(() => form.toDraft(form.blank));
    const [deleting, setDeleting] = useState<T | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    const open = (option: T) => {
        setEditing(option);
        setDraft(form.toDraft(option));
    };

    const save = async () => {
        if (!editing) return;
        const problem = form.problem(draft);
        if (problem) return Toast.Warning(problem);

        setSaving(true);
        await onSave(form.toSaved(editing, draft));
        setSaving(false);
        setEditing(null);
    };

    const confirmDelete = async () => {
        if (deleting?.id) await onDelete(deleting.id);
        setDeleting(null);
    };

    return {
        editing,
        open,
        /** Opens a new option. */
        add: () => open(form.blank),
        close: () => setEditing(null),
        draft,
        /** Changes any of the form's fields. */
        change: (changes: Partial<D>) => setDraft((d) => ({ ...d, ...changes })),
        saving,
        save,
        deleting,
        setDeleting,
        confirmDelete,
        /** Moves an option up (-1) or down (1). */
        move: (index: number, by: number) => onReorder(MovedIds(options, index, by)),
    };
};
