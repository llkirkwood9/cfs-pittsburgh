import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DefaultGeneralSettings } from "../Models/GeneralSettings";
import type { GeneralSettings } from "../Models/GeneralSettings";
import { GetGeneralSettings } from "../Services/SettingsServices";

type SettingsContextValue = {
    /** The settings in force; the defaults until the saved ones arrive. */
    settings: GeneralSettings;
    /** Use these settings now - after the Settings screen saves them. */
    apply: (settings: GeneralSettings) => void;
    /** Read them again from the server. */
    refresh: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * The business details and dashboard levels set under Settings, for every screen: the app name
 * in the menu bar and browser tab, the company and phone on the sales sheet, the dashboard's
 * stars and running-low level. Read once when the app opens - they rarely change - and again
 * whenever the Settings screen saves.
 */
export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<GeneralSettings>(DefaultGeneralSettings);

    const refresh = useCallback(async () => {
        const found = await GetGeneralSettings();
        if (found) setSettings(found);
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        document.title = settings.appName;
    }, [settings.appName]);

    return (
        <SettingsContext.Provider value={{ settings, apply: setSettings, refresh }}>
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
