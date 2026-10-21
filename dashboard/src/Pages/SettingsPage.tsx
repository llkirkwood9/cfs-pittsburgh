import { useCallback, useEffect, useState } from "react";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import BusinessDetailsSettings from "../Components/Settings/BusinessDetailsSettings";
import DashboardSettings from "../Components/Settings/DashboardSettings";
import FinanceSettings from "../Components/Settings/FinanceSettings";
import NewEventSettings from "../Components/Settings/NewEventSettings";
import ReceiptEmailSettings from "../Components/Settings/ReceiptEmailSettings";
import { SettingsScopeContext } from "../Components/Settings/SettingsScope";
import TermsSettings from "../Components/Settings/TermsSettings";
import { useAuth } from "../Context/AuthContext";
import { useSettings } from "../Context/SettingsContext";
import { useTerritory } from "../Context/TerritoryContext";
import type { GeneralSettings } from "../Models/GeneralSettings";
import { IsCompanyWide } from "../Models/User";
import { GetGeneralSettings } from "../Services/SettingsServices";

const sections = [
    { id: "business", label: "Business details", icon: "fa-solid fa-building" },
    { id: "terms", label: "Sales sheet terms", icon: "fa-solid fa-file-signature" },
    { id: "receipt-email", label: "Receipt email", icon: "fa-solid fa-envelope" },
    { id: "financing", label: "Financing", icon: "fa-solid fa-file-invoice-dollar" },
    { id: "events", label: "New events", icon: "fa-solid fa-calendar-plus" },
    { id: "dashboard", label: "Dashboard", icon: "fa-solid fa-chart-column" },
];

/**
 * Settings: the business details printed on sheets and emails, the terms customers initial, the
 * receipt email's wording, the finance options, new events' rates and the dashboard's levels.
 * System Admins and administrators set the company-wide values; each territory can change any of
 * them for itself (its manager can too), and anything it leaves alone follows the company. Each
 * card saves on its own.
 */
const SettingsPage = () => {
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
    const active = territories.filter((t) => t.isActive !== false);

    return (
        <div className="mx-auto max-w-6xl p-3 sm:p-4">
            <h1 className="mb-1 text-xl font-bold">Settings</h1>

            {canSwitch ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                        Editing
                    </span>
                    <select
                        value={scopeId ?? ""}
                        onChange={(e) => setScopeId(e.target.value ? Number(e.target.value) : null)}
                        aria-label="Which settings to edit"
                        className="min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 text-base font-semibold
                            dark:border-zinc-600 dark:bg-zinc-800 dark:scheme-dark"
                    >
                        {companyWide && <option value="">Company-wide settings</option>}
                        {active.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </div>
            ) : null}

            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                {scopeId == null
                    ? "These apply in every territory, except where a territory has set its own. Each section saves on its own."
                    : `These apply in ${scopeName}. Anything ${scopeName} hasn't changed follows the company-wide settings; put a section back to follow them again. Each section saves on its own.`}
            </p>

            <nav aria-label="Settings sections" className="mb-4 flex flex-wrap gap-2">
                {sections.map((s) => (
                    <a
                        key={s.id}
                        href={`#${s.id}`}
                        onClick={(e) => {
                            e.preventDefault();
                            document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 text-sm font-semibold
                            text-zinc-700 hover:border-sky-600 hover:text-sky-800
                            dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:text-sky-200"
                    >
                        <Icon icon={s.icon} className="text-xs" />
                        {s.label}
                    </a>
                ))}
            </nav>

            {settings == null ? (
                <ListSkeleton rows={6} />
            ) : (
                // Keyed so switching scope starts every card afresh with that scope's values.
                <SettingsScopeContext.Provider
                    key={scopeId ?? "company"}
                    value={{ territoryId: scopeId, scopeName, settings, apply }}
                >
                    <div className="space-y-4">
                        <BusinessDetailsSettings />
                        <TermsSettings />
                        <ReceiptEmailSettings />
                        <FinanceSettings />
                        <NewEventSettings />
                        <DashboardSettings />
                    </div>
                </SettingsScopeContext.Provider>
            )}
        </div>
    );
};

export default SettingsPage;
