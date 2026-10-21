import { createContext, useContext } from "react";
import type { GeneralSettings } from "../../Models/GeneralSettings";

export type SettingsScopeValue = {
    /** The territory being edited; null for the company-wide settings. */
    territoryId: number | null;
    /** "Company-wide" or the territory's name. */
    scopeName: string;
    /** The settings in force for that scope. */
    settings: GeneralSettings;
    /** Use these settings now, after a card saves. */
    apply: (settings: GeneralSettings) => void;
};

export const SettingsScopeContext = createContext<SettingsScopeValue | null>(null);

/**
 * The settings the Settings screen is editing: the company-wide ones, or one territory's. A
 * territory's settings start out following the company's; whatever it changes is its own until
 * it's put back.
 * @returns The scope.
 */
export const useSettingsScope = (): SettingsScopeValue => {
    const context = useContext(SettingsScopeContext);
    if (!context) throw new Error("useSettingsScope must be used inside the Settings screen");
    return context;
};
