import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { setTerritoryHeader } from "../Lib/api";
import { IsCompanyWide } from "../Models/User";
import type { Territory } from "../Models/Territory";
import { GetTerritories } from "../Services/TerritoryServices";

const STORAGE_KEY = "cfs.territory";

type TerritoryContextValue = {
    /** Territories the user can pick from (owners and administrators), or just their own. */
    territories: Territory[];
    /** The territory being worked in; null when an owner or administrator is viewing them all. */
    territoryId: number | null;
    /** Its name, or "All territories". */
    territoryName: string;
    /** Owners and administrators can switch territory; everyone else is fixed to their own. */
    canSwitch: boolean;
    /** Switch the territory in view (owners and administrators). */
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
 * Which territory the dashboard is showing. Crew always see their own. Owners and administrators
 * pick one from the menu bar - or All territories - and every request carries the choice, so
 * lists, the dashboard and the settings follow it. The choice is remembered on the device.
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

    // A remembered territory that has since been switched off or deleted falls back to all.
    useEffect(() => {
        if (!companyWide || selected == null || territories.length === 0) return;
        if (!territories.some((t) => t.id === selected && t.isActive !== false)) setSelected(null);
    }, [companyWide, selected, territories]);

    const territoryId = companyWide ? selected : (user?.territoryId ?? null);

    // Set synchronously during render, so the requests children make on this render already
    // carry it.
    setTerritoryHeader(companyWide ? selected : null);

    const setTerritoryId = useCallback((id: number | null) => {
        setSelected(id);
        try {
            if (id == null) localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, String(id));
        } catch {
            // Private browsing: just not remembered.
        }
    }, []);

    const territoryName = useMemo(() => {
        if (territoryId == null) return companyWide ? "All territories" : "";
        return (
            territories.find((t) => t.id === territoryId)?.name ??
            (territoryId === user?.territoryId ? (user?.territoryName ?? "") : "")
        );
    }, [territoryId, territories, companyWide, user]);

    return (
        <TerritoryContext.Provider
            value={{
                territories,
                territoryId,
                territoryName,
                canSwitch: companyWide,
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
