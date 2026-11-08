import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../Context/AuthContext";
import { useSettings } from "../Context/SettingsContext";
import type { SettingsScopeValue } from "../Context/SettingsScope";
import { useTerritory } from "../Context/TerritoryContext";
import type { GeneralSettings } from "../Models/GeneralSettings";
import { ActiveTerritories } from "../Models/Territory";
import { IsCompanyWide } from "../Models/User";
import { GetGeneralSettings } from "../Services/SettingsServices";

/**
 * The Settings screen: which settings are being edited - the company-wide ones or a territory's -
 * and those settings, for the cards to share.
 * @returns The scope being edited and the choices.
 */
export const useSettingsPage = () => {
    const { refresh: refreshInView } = useSettings();
    const { user } = useAuth();
    const { territories, territoryId: territoryInView, canSwitch, territoryName } = useTerritory();
    const companyWide = IsCompanyWide(user?.role);

    // Start on the territory in view. Viewing every territory, system admins and administrators
    // start on the company-wide settings; a manager with several territories on their first.
    const [scopeId, setScopeId] = useState<number | null>(
        territoryInView ?? (companyWide ? null : (user?.territoryIds?.[0] ?? null))
    );
    const [settings, setSettings] = useState<GeneralSettings | null>(null);

    const load = useCallback(async (id: number | null) => {
        setSettings(null);
        setSettings(await GetGeneralSettings(id));
    }, []);

    useEffect(() => {
        load(scopeId);
    }, [scopeId, load]);

    const apply = (next: GeneralSettings) => {
        setSettings(next);
        // Whatever is on screen elsewhere picks the change up too.
        refreshInView();
    };

    const scopeName =
        scopeId == null
            ? "Company-wide"
            : (territories.find((t) => t.id === scopeId)?.name ?? territoryName);

    /** The cards' shared scope, once its settings have loaded. */
    const scope: SettingsScopeValue | null = settings
        ? { territoryId: scopeId, scopeName, settings, apply }
        : null;

    return {
        /** Whether the user can pick which settings to edit. */
        canSwitch,
        /** Whether the company-wide settings are one of the choices. */
        companyWide,
        /** The territories whose settings can be picked. */
        territories: ActiveTerritories(territories),
        scopeId,
        setScopeId,
        scopeName,
        scope,
    };
};
