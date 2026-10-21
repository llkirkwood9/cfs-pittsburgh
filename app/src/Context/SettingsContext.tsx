import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useTerritory } from "./TerritoryContext";
import { GetServerUrl } from "../Lib/Server";
import { DefaultGeneralSettings } from "../Models/GeneralSettings";
import type { GeneralSettings } from "../Models/GeneralSettings";
import { GetGeneralSettings, GetPublicSettings } from "../Services/SettingsServices";

type SettingsContextValue = {
    /** The settings in force for the territory in view; the defaults until they arrive. */
    settings: GeneralSettings;
    /** Use these settings now - after the Settings screen saves the ones in view. */
    apply: (settings: GeneralSettings) => void;
    /** Read them again from the server. */
    refresh: () => Promise<void>;
    /** Another territory's settings - an order's, when viewing every territory. Cached. */
    settingsFor: (territoryId: number | null | undefined) => Promise<GeneralSettings>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * The business details and dashboard levels set under Settings, for every screen: the app name
 * on the sign-in screen and menu bar, the company and phone on the sales sheet, the dashboard's
 * stars and running-low level. Each territory can have its own, so they follow the territory in
 * view. Read when the app opens, the server or the territory changes, and whenever Settings saves.
 */
export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const { territoryId } = useTerritory();
    const [settings, setSettings] = useState<GeneralSettings>(DefaultGeneralSettings);
    const cache = useRef(new Map<string, GeneralSettings>());

    const signedIn = Boolean(user) && !user?.mustChangePassword;

    const refresh = useCallback(async () => {
        cache.current.clear();
        // Nothing to read from a build made without a server.
        if (!GetServerUrl()) return;
        if (!signedIn) {
            // Signed out, only the app name is public.
            const found = await GetPublicSettings();
            if (found?.appName) setSettings((s) => ({ ...s, appName: found.appName! }));
            return;
        }
        const found = await GetGeneralSettings(territoryId);
        if (found) setSettings(found);
    }, [signedIn, territoryId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const settingsFor = useCallback(
        async (id: number | null | undefined): Promise<GeneralSettings> => {
            if (id == null || id === territoryId) return settings;
            const key = String(id);
            const cached = cache.current.get(key);
            if (cached) return cached;
            const found = await GetGeneralSettings(id);
            if (!found) return settings;
            cache.current.set(key, found);
            return found;
        },
        [settings, territoryId]
    );

    const apply = useCallback((next: GeneralSettings) => {
        cache.current.clear();
        setSettings(next);
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, apply, refresh, settingsFor }}>
            {children}
        </SettingsContext.Provider>
    );
};

/**
 * The settings in force.
 * @returns The settings, plus apply and refresh.
 */
export const useSettings = (): SettingsContextValue => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error("useSettings must be used inside SettingsProvider");
    return context;
};

/**
 * The settings for a particular territory, such as the one an order was taken in: the ones in
 * view while they load, then that territory's own.
 * @param territoryId The territory, or null/undefined for the one in view.
 * @returns The settings.
 */
export const useSettingsFor = (territoryId: number | null | undefined): GeneralSettings => {
    const { settings, settingsFor } = useSettings();
    const [found, setFound] = useState<GeneralSettings>(settings);

    useEffect(() => {
        let cancelled = false;
        settingsFor(territoryId).then((s) => {
            if (!cancelled) setFound(s);
        });
        return () => {
            cancelled = true;
        };
    }, [territoryId, settingsFor]);

    return found;
};
