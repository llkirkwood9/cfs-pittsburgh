import { useCallback, useEffect, useState } from "react";
import { Toast } from "@host";
import { useTerritory } from "../Context/TerritoryContext";
import { ActiveTerritories } from "../Models/Territory";
import type { Territory } from "../Models/Territory";
import {
    AddTerritory,
    DeleteTerritory,
    GetTerritories,
    UpdateTerritory,
} from "../Services/TerritoryServices";

/**
 * The Territories screen: every territory, and adding, renaming, switching off or on and deleting
 * one. Each change also refreshes the territory picker.
 * @returns The state and handlers.
 */
export const useTerritories = () => {
    const { reload: reloadPicker, setTerritoryId } = useTerritory();
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [editing, setEditing] = useState<Territory | null>(null);
    const [name, setName] = useState<string>("");
    // A new territory's catalog: empty, or a copy of another territory's.
    const [copyFrom, setCopyFrom] = useState<number | null>(null);
    const [saving, setSaving] = useState<boolean>(false);
    const [switchingOff, setSwitchingOff] = useState<Territory | null>(null);
    const [deleting, setDeleting] = useState<Territory | null>(null);

    const load = useCallback(async () => {
        setTerritories((await GetTerritories(true)) ?? []);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const afterChange = async () => {
        await load();
        await reloadPicker();
    };

    const open = (territory: Territory) => {
        setEditing(territory);
        setName(territory.name ?? "");
        setCopyFrom(null);
    };

    const save = async () => {
        if (!name.trim()) return Toast.Warning("Enter the territory's name.");

        setSaving(true);
        const saved = editing?.id
            ? await UpdateTerritory({ id: editing.id, name: name.trim() })
            : await AddTerritory(name.trim(), copyFrom);
        setSaving(false);

        if (!saved) return;
        Toast.Success(
            !editing?.id && copyFrom != null
                ? `${saved.name} added, with ${saved.productCount ?? 0} products copied into its catalog.`
                : `${saved.name} saved.`
        );
        setEditing(null);
        await afterChange();
    };

    /**
     * Switches a territory on or off.
     * @param territory The territory.
     * @param isActive On or off.
     */
    const setActive = async (territory: Territory, isActive: boolean) => {
        const saved = await UpdateTerritory({ id: territory.id, isActive });
        setSwitchingOff(null);
        if (!saved) return;
        Toast.Success(isActive ? `${saved.name} switched back on.` : `${saved.name} switched off.`);
        await afterChange();
    };

    const confirmDelete = async () => {
        if (!deleting?.id) return;
        const done = await DeleteTerritory(deleting.id);
        setDeleting(null);
        if (!done) return;
        Toast.Success("Territory deleted.");
        await afterChange();
    };

    return {
        territories,
        /** The territories a new one's catalog can be copied from. */
        copySources: ActiveTerritories(territories),
        loading,
        load,
        /** Works in a territory: makes it the one in view. */
        workIn: (territory: Territory) => setTerritoryId(territory.id ?? null),
        editing,
        open,
        /** Opens a new territory. */
        add: () => open({ isActive: true }),
        close: () => setEditing(null),
        name,
        setName,
        copyFrom,
        setCopyFrom,
        saving,
        save,
        setActive,
        switchingOff,
        setSwitchingOff,
        deleting,
        setDeleting,
        confirmDelete,
    };
};
