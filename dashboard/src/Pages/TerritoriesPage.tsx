import { useEffect, useState } from "react";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import TextField from "../Components/Elements/TextField";
import { useTerritory } from "../Context/TerritoryContext";
import { Toast } from "../Lib/Toast";
import type { Territory } from "../Models/Territory";
import {
    AddTerritory,
    DeleteTerritory,
    GetTerritories,
    UpdateTerritory,
} from "../Services/TerritoryServices";

/**
 * Territories, for system admins and administrators. Each one has its own crew, events, stock, catalog
 * items and settings; managers look after a single territory. A territory can be renamed or
 * switched off at any time, and deleted while nothing belongs to it yet.
 */
const TerritoriesPage = () => {
    const { reload: reloadPicker, setTerritoryId } = useTerritory();
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [editing, setEditing] = useState<Territory | null>(null);
    const [name, setName] = useState<string>("");
    const [saving, setSaving] = useState<boolean>(false);
    const [switchingOff, setSwitchingOff] = useState<Territory | null>(null);
    const [deleting, setDeleting] = useState<Territory | null>(null);

    const load = async () => {
        setTerritories(await GetTerritories(true));
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const afterChange = async () => {
        await load();
        await reloadPicker();
    };

    const open = (territory: Territory) => {
        setEditing(territory);
        setName(territory.name ?? "");
    };

    const handleSave = async () => {
        if (!name.trim()) return Toast.Warning("Enter the territory's name.");

        setSaving(true);
        const saved = editing?.id
            ? await UpdateTerritory({ id: editing.id, name: name.trim() })
            : await AddTerritory(name.trim());
        setSaving(false);

        if (!saved) return;
        Toast.Success(`${saved.name} saved.`);
        setEditing(null);
        await afterChange();
    };

    const setActive = async (territory: Territory, isActive: boolean) => {
        const saved = await UpdateTerritory({ id: territory.id, isActive });
        setSwitchingOff(null);
        if (!saved) return;
        Toast.Success(isActive ? `${saved.name} switched back on.` : `${saved.name} switched off.`);
        await afterChange();
    };

    const handleDelete = async () => {
        if (!deleting?.id) return;
        const done = await DeleteTerritory(deleting.id);
        setDeleting(null);
        if (!done) return;
        Toast.Success("Territory deleted.");
        await afterChange();
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-3xl p-4">
                <ListSkeleton rows={3} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl p-3 sm:p-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">Territories</h1>
                <Button
                    text="Add territory"
                    icon="fa-solid fa-plus"
                    onClick={() => open({ isActive: true })}
                    className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                />
            </div>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                Each territory has its own crew, events, stock and settings, and can add catalog
                items of its own alongside the global ones. System Admins and administrators work
                across all of them; pick one from the menu bar to work in it.
            </p>

            {territories.length === 0 && (
                <p className="rounded-xl bg-white p-6 text-center text-sm text-zinc-500 shadow-sm dark:bg-zinc-800 dark:text-zinc-400">
                    No territories yet. Add one to start taking events.
                </p>
            )}

            <ul className="space-y-2">
                {territories.map((territory) => {
                    const empty =
                        !territory.userCount && !territory.eventCount && !territory.productCount;
                    return (
                        <li
                            key={territory.id}
                            className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                    {territory.name}
                                    {territory.isActive === false && (
                                        <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                                            Off
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {territory.userCount ?? 0} crew &middot;{" "}
                                    {territory.eventCount ?? 0} events &middot;{" "}
                                    {territory.productCount ?? 0} own catalog items
                                </p>
                                {territory.activeEvent && (
                                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                                        <Icon icon="fa-solid fa-circle-play" />
                                        Active event: {territory.activeEvent}
                                    </p>
                                )}
                            </div>

                            {territory.isActive !== false && (
                                <Button
                                    text="View"
                                    icon="fa-solid fa-eye"
                                    title="Work in this territory"
                                    onClick={() => setTerritoryId(territory.id ?? null)}
                                    className="min-h-[40px] bg-sky-700 px-3 text-sm hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-700"
                                />
                            )}
                            <Button
                                text="Rename"
                                icon="fa-solid fa-pen"
                                onClick={() => open(territory)}
                                className="min-h-[40px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                            />
                            {territory.isActive === false ? (
                                <Button
                                    text="Switch on"
                                    icon="fa-solid fa-power-off"
                                    onClick={() => setActive(territory, true)}
                                    className="min-h-[40px] bg-green-700 px-3 text-sm hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                                />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setSwitchingOff(territory)}
                                    aria-label="Switch territory off"
                                    title="Switch off"
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700
                                        hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                    <Icon icon="fa-solid fa-power-off" />
                                </button>
                            )}
                            {empty && (
                                <button
                                    type="button"
                                    onClick={() => setDeleting(territory)}
                                    aria-label="Delete territory"
                                    title="Delete"
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700
                                        hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                    <Icon icon="fa-solid fa-trash" />
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>

            {editing && (
                <Modal
                    title={editing.id ? "Rename territory" : "Add territory"}
                    onClose={() => setEditing(null)}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={() => setEditing(null)}
                                className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                            />
                            <Button
                                text="Save"
                                icon="fa-solid fa-check"
                                onClick={handleSave}
                                loading={saving}
                            />
                        </>
                    }
                >
                    <TextField
                        label="Name"
                        value={name}
                        onChange={setName}
                        maxLength={100}
                        autoFocus
                    />
                    {!editing.id && (
                        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                            A new territory starts with the company-wide settings and the global
                            catalog. Add its manager and crew on the Crew screen.
                        </p>
                    )}
                </Modal>
            )}

            {switchingOff && (
                <ConfirmationModal
                    title="Switch territory off"
                    message={`Switch ${switchingOff.name} off? Its crew are signed out and can't sign back in, and its active event is closed, until it is switched back on. Nothing is deleted.`}
                    confirmText="Switch off"
                    destructive
                    onConfirm={() => setActive(switchingOff, false)}
                    onCancel={() => setSwitchingOff(null)}
                />
            )}

            {deleting && (
                <ConfirmationModal
                    title="Delete territory"
                    message={`Delete ${deleting.name}? Nothing belongs to it yet, so nothing else is affected.`}
                    confirmText="Delete"
                    destructive
                    onConfirm={handleDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </div>
    );
};

export default TerritoriesPage;
