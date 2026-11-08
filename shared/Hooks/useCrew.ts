import { useCallback, useEffect, useState } from "react";
import { Toast } from "@host";
import { useAuth } from "../Context/AuthContext";
import {
    AssignableRoles,
    BuildCrewMember,
    CanManageCrew,
    MakePassword,
    NewCrewTerritoryIds,
    TerritoriesElsewhere,
} from "../Lib/Crew";
import type { CrewForm, RandomValues } from "../Lib/Crew";
import { ActiveTerritories } from "../Models/Territory";
import type { Territory } from "../Models/Territory";
import { HasRole, IsCompanyWide } from "../Models/User";
import type { User } from "../Models/User";
import { AddUser, DeleteUser, GetUsers, UpdateUser } from "../Services/UserServices";

const emptyForm: CrewForm = {
    name: "",
    username: "",
    email: "",
    role: "Sales",
    password: "",
    territoryIds: [],
    isActive: true,
    unlock: false,
};

/**
 * The Crew screen: the accounts, the add/edit form, and deactivating or deleting an account.
 * @param territories The territories the user can pick from.
 * @param territoryInView The territory picked in the menu bar, or null for all of them.
 * @param randomValues The platform's secure random source, for new passwords.
 * @returns The screen's state and handlers.
 */
export const useCrew = (
    territories: Territory[],
    territoryInView: number | null,
    randomValues: RandomValues
) => {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [editing, setEditing] = useState<User | null>(null);
    const [form, setForm] = useState<CrewForm>(emptyForm);
    const [saving, setSaving] = useState<boolean>(false);
    const [deactivating, setDeactivating] = useState<User | null>(null);
    const [removing, setRemoving] = useState<User | null>(null);

    const load = useCallback(async () => {
        setUsers(await GetUsers());
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const isSystemAdmin = HasRole(user?.role, "SystemAdmin");
    const companyWide = IsCompanyWide(user?.role);
    const assignable = AssignableRoles(user?.role);
    // The territories this user can put people in: every switched-on one for system admins and
    // administrators, a manager's own for a manager.
    const activeTerritories = ActiveTerritories(territories);
    // Someone with only one territory to offer doesn't need to choose.
    const chooseTerritories = companyWide || activeTerritories.length > 1;

    const canManage = (crew: User): boolean => (user ? CanManageCrew(user, crew) : false);

    /**
     * Changes one field of the open form.
     * @param key The field.
     * @param value Its new value.
     */
    const setField = <K extends keyof CrewForm>(key: K, value: CrewForm[K]) =>
        setForm((f) => ({ ...f, [key]: value }));

    /**
     * Ticks or unticks a territory on the open form.
     * @param id The territory.
     * @param checked Whether they work in it.
     */
    const toggleTerritory = (id: number, checked: boolean) =>
        setForm((f) => ({
            ...f,
            territoryIds: checked
                ? [...f.territoryIds, id]
                : f.territoryIds.filter((t) => t !== id),
        }));

    /** Puts a fresh random password in the open form. */
    const newPassword = () => setField("password", MakePassword(randomValues));

    /**
     * Opens the form for an account, or for a new one.
     * @param crew The account, or a new one with its starting role.
     */
    const open = (crew: User) => {
        setEditing(crew);
        setForm({
            name: crew.name ?? "",
            username: crew.username ?? "",
            email: crew.email ?? "",
            role: crew.role ?? "Sales",
            isActive: crew.isActive ?? true,
            territoryIds: crew.id
                ? (crew.territoryIds ?? [])
                : NewCrewTerritoryIds(territoryInView, activeTerritories),
            unlock: false,
            // A new account gets a ready-made password to hand over; an existing one keeps its
            // own unless a new one is entered.
            password: crew.id ? "" : MakePassword(randomValues),
        });
    };

    const close = () => setEditing(null);

    const handleSave = async () => {
        const built = BuildCrewMember(form, editing?.id, activeTerritories, chooseTerritories);
        if ("problem" in built) return Toast.Warning(built.problem);

        setSaving(true);
        const saved = editing?.id ? await UpdateUser(built.user) : await AddUser(built.user);
        setSaving(false);

        if (!saved) return;

        Toast.Success(
            form.password
                ? `${saved.name} saved. Give them the password - they'll choose their own when they sign in.`
                : `${saved.name} saved.`
        );
        setEditing(null);
        await load();
    };

    const handleDeactivate = async () => {
        if (!deactivating?.id) return;

        const success = await DeleteUser(deactivating.id);
        setDeactivating(null);

        if (success) {
            Toast.Success("Account deactivated.");
            await load();
        }
    };

    // System admin only: delete the account for good. Their sales stay; every place that named
    // them is cleared.
    const handleRemove = async () => {
        if (!removing?.id) return;

        const success = await DeleteUser(removing.id, true);
        setRemoving(null);

        if (success) {
            Toast.Success("Account deleted.");
            await load();
        }
    };

    return {
        user,
        users,
        loading,
        load,
        isSystemAdmin,
        assignable,
        activeTerritories,
        chooseTerritories,
        canManage,
        editing,
        /** Territories the person being edited works in that this user can't offer. */
        elsewhere: editing && !companyWide ? TerritoriesElsewhere(editing, activeTerritories) : [],
        /** The person being edited is the signed-in user, who can't change their own role. */
        editingSelf: Boolean(editing) && editing?.id === user?.id,
        form,
        setField,
        toggleTerritory,
        newPassword,
        open,
        close,
        saving,
        handleSave,
        deactivating,
        setDeactivating,
        handleDeactivate,
        removing,
        setRemoving,
        handleRemove,
    };
};
