import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Page from "../Components/Elements/Page";
import SelectField from "../Components/Elements/SelectField";
import Text from "../Components/Elements/Text";
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

    const scrollRef = useRef<ScrollView>(null);
    // Where each card starts within the list of cards, and where that list starts on the page.
    const positions = useRef<Record<string, number>>({});
    const listTop = useRef<number>(0);

    const place = (id: string, y: number) => {
        positions.current[id] = y;
    };

    const jump = (id: string) => {
        const y = positions.current[id];
        if (y === undefined) return;
        scrollRef.current?.scrollTo({ y: Math.max(0, listTop.current + y - 8), animated: true });
    };

    return (
        <Page edges={["left", "right"]} scrollRef={scrollRef}>
            <View className="mx-auto w-full max-w-6xl">
                {canSwitch && (
                    <SelectField<number | null>
                        label="Editing"
                        value={scopeId}
                        options={[
                            ...(companyWide ? [{ value: null, label: "Company-wide settings" }] : []),
                            ...active.map((t) => ({ value: t.id ?? null, label: t.name ?? "" })),
                        ]}
                        onChange={setScopeId}
                        className="mb-3"
                    />
                )}
                <Text className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {scopeId == null
                        ? "These apply in every territory, except where a territory has set its own."
                        : `These apply in ${scopeName}. Anything not changed here follows the company-wide settings.`}
                </Text>

                <View
                    accessibilityLabel="Settings sections"
                    className="mb-4 flex-row flex-wrap gap-2"
                >
                    {sections.map((s) => (
                        <Pressable
                            key={s.id}
                            onPress={() => jump(s.id)}
                            accessibilityRole="link"
                            className="min-h-[40px] flex-row items-center gap-2 rounded-full border border-zinc-300 bg-white px-3
                                active:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800"
                        >
                            <Icon icon={s.icon} className="text-xs text-zinc-700 dark:text-zinc-200" />
                            <Text className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                                {s.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {settings == null ? (
                    <ListSkeleton rows={6} />
                ) : (
                    // Keyed so switching scope starts every card afresh with that scope's values.
                    <SettingsScopeContext.Provider
                        key={scopeId ?? "company"}
                        value={{ territoryId: scopeId, scopeName, settings, apply }}
                    >
                        <View
                            className="gap-4"
                            onLayout={(e) => (listTop.current = e.nativeEvent.layout.y)}
                        >
                            <BusinessDetailsSettings onLayout={place} />
                            <TermsSettings onLayout={place} />
                            <ReceiptEmailSettings onLayout={place} />
                            <FinanceSettings onLayout={place} />
                            <NewEventSettings onLayout={place} />
                            <DashboardSettings onLayout={place} />
                        </View>
                    </SettingsScopeContext.Provider>
                )}
            </View>
        </Page>
    );
};

export default SettingsPage;
