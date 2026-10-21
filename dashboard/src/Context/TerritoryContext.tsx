import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { setTerritoryHeader } from "../Lib/api";
import { IsCompanyWide } from "../Models/User";
import type { Territory } from "../Models/Territory";
import { GetTerritories } from "../Services/TerritoryServices";

const STORAGE_KEY = "cfs.territory";

type TerritoryContextValue = {
    /** Territories the user can pick from: every one for system admins and administrators, their own for everyone else. */
    territories: Territory[];
    /** The territory being worked in; null when all of the user's territories are in view. */
    territoryId: number | null;
    /** Its name, or "All territories" / "All my territories". */
    territoryName: string;
    /** Anyone with more than one territory can switch between them, or view them all. */
    canSwitch: boolean;
    /** What viewing them all is called: "All territories", or "All my territories". */
    allLabel: string;
    /** Switch the territory in view. */
    setTerritoryId: (id: number | null) => void;
    /** Read the list again, after one is added or renamed. */
    reload: () => Promise<void>;
};

const TerritoryContext = createContext<TerritoryContextValue | null>(null);

const readStored = (): number | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? Number(raw) || null : null;
    } catch {
        return null;
    }
};

/**
 * Which territory the dashboard is showing. Someone in one territory always sees it. Anyone with
 * more - system admins and administrators have every territory - picks one from the menu bar, or
 * all of theirs, and every request carries the choice, so lists, the dashboard and the settings
 * follow it. The choice is remembered on the device.
 */
export const TerritoryProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const companyWide = IsCompanyWide(user?.role);
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [selected, setSelected] = useState<number | null>(readStored);

    const reload = useCallback(async () => {
        if (!user || user.mustChangePassword) {
            setTerritories([]);
            return;
        }
        setTerritories(await GetTerritories());
    }, [user]);

    useEffect(() => {
        reload();
    }, [reload]);

    const own = user?.territoryIds ?? (user?.territoryId != null ? [user.territoryId] : []);
    const canSwitch = companyWide || own.length > 1;

    // A remembered territory that has since been switched off, deleted, or isn't theirs falls
    // back to all of theirs.
    useEffect(() => {
        if (!canSwitch || selected == null || territories.length === 0) return;
        if (!territories.some((t) => t.id === selected && t.isActive !== false)) setSelected(null);
    }, [canSwitch, selected, territories]);

    const territoryId = canSwitch ? selected : (own[0] ?? null);

    // Set synchronously during render, so the requests children make on this render already
    // carry it.
    setTerritoryHeader(canSwitch ? selected : null);

    const setTerritoryId = useCallback((id: number | null) => {
        setSelected(id);
        try {
            if (id == null) localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, String(id));
        } catch {
            // Private browsing: just not remembered.
        }
    }, []);

    const allLabel = companyWide ? "All territories" : "All my territories";
    const territoryName = useMemo(() => {
        if (territoryId == null) return canSwitch ? allLabel : "";
        const index = user?.territoryIds?.indexOf(territoryId) ?? -1;
        return (
            territories.find((t) => t.id === territoryId)?.name ??
            (index >= 0 ? (user?.territoryNames?.[index] ?? "") : (user?.territoryName ?? ""))
        );
    }, [territoryId, territories, canSwitch, allLabel, user]);

    return (
        <TerritoryContext.Provider
            value={{
                territories,
                territoryId,
                territoryName,
                canSwitch,
                allLabel,
                setTerritoryId,
                reload,
            }}
        >
            {children}
        </TerritoryContext.Provider>
    );
};

/**
 * The territory in view.
 * @returns The territory context value.
 */
export const useTerritory = (): TerritoryContextValue => {
    const context = useContext(TerritoryContext);
    if (!context) throw new Error("useTerritory must be used inside TerritoryProvider");
    return context;
};
