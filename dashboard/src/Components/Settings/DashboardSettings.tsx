import { useEffect, useState } from "react";
import ConfirmationModal from "../Elements/ConfirmationModal";
import TextField from "../Elements/TextField";
import SettingsCard from "./SettingsCard";
import { useSettingsScope } from "./SettingsScope";
import { FormatCurrency } from "../../Lib/ModelHelpers";
import { Toast } from "../../Lib/Toast";
import { DefaultGeneralSettings } from "../../Models/GeneralSettings";
import { SaveGeneralSettings } from "../../Services/SettingsServices";

/** Matches the server's limits. */
const MAX_AMOUNT = 10_000_000;
const MAX_LOW = 999;

/** Reads a typed amount such as "30,000" or "$30000". */
const ParseAmount = (value: string): number => Number(value.replace(/[$,\s]/g, ""));

/**
 * The dashboard's levels: when the Net sales tile earns its stars, and how few of a counted item
 * is "running low" on the dashboard and the Inventory screen.
 */
const DashboardSettings = () => {
    const { settings, apply, territoryId } = useSettingsScope();
    const defaults = settings.defaults ?? DefaultGeneralSettings;

    const [firstAt, setFirstAt] = useState<string>(String(settings.starsFirstAt));
    const [every, setEvery] = useState<string>(String(settings.starsEvery));
    const [lowAt, setLowAt] = useState<string>(String(settings.lowStockAt));
    const [saving, setSaving] = useState<boolean>(false);
    const [resetting, setResetting] = useState<boolean>(false);

    useEffect(() => {
        setFirstAt(String(settings.starsFirstAt));
        setEvery(String(settings.starsEvery));
        setLowAt(String(settings.lowStockAt));
    }, [settings.starsFirstAt, settings.starsEvery, settings.lowStockAt]);

    const first = ParseAmount(firstAt);
    const step = ParseAmount(every);
    const low = Number(lowAt.trim());
    const firstOk = Number.isFinite(first) && first > 0 && first <= MAX_AMOUNT;
    const stepOk = Number.isFinite(step) && step > 0 && step <= MAX_AMOUNT;
    const lowOk = lowAt.trim() !== "" && Number.isInteger(low) && low >= 0 && low <= MAX_LOW;

    const dirty =
        first !== settings.starsFirstAt ||
        step !== settings.starsEvery ||
        low !== settings.lowStockAt;
    const isDefault =
        settings.starsFirstAt === defaults.starsFirstAt &&
        settings.starsEvery === defaults.starsEvery &&
        settings.lowStockAt === defaults.lowStockAt;

    const save = async (values: {
        starsFirstAt: number;
        starsEvery: number;
        lowStockAt: number;
    }) => {
        setSaving(true);
        const result = await SaveGeneralSettings(values, territoryId);
        setSaving(false);
        if (!result) return false;
        apply(result);
        return true;
    };

    const handleSave = async () => {
        if (!firstOk || !stepOk)
            return Toast.Warning(
                `Star amounts must be more than $0 and at most ${FormatCurrency(MAX_AMOUNT)}.`
            );
        if (!lowOk)
            return Toast.Warning(`Running low must be a whole number from 0 to ${MAX_LOW}.`);
        if (await save({ starsFirstAt: first, starsEvery: step, lowStockAt: low }))
            Toast.Success("Dashboard settings saved.");
    };

    const handleReset = async () => {
        setResetting(false);
        if (
            await save({
                starsFirstAt: defaults.starsFirstAt,
                starsEvery: defaults.starsEvery,
                lowStockAt: defaults.lowStockAt,
            })
        )
            Toast.Success("Dashboard settings are back to the defaults.");
    };

    return (
        <SettingsCard
            id="dashboard"
            title="Dashboard"
            icon="fa-solid fa-chart-column"
            description="Net sales stars and the running-low level."
            status={isDefault ? "Using the default levels." : "Using your own levels."}
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onDiscard={() => {
                setFirstAt(String(settings.starsFirstAt));
                setEvery(String(settings.starsEvery));
                setLowAt(String(settings.lowStockAt));
            }}
            onReset={isDefault ? undefined : () => setResetting(true)}
        >
            <div className="grid gap-4 md:grid-cols-3">
                <TextField
                    label="First star at ($)"
                    inputMode="decimal"
                    value={firstAt}
                    onChange={setFirstAt}
                    placeholder={String(defaults.starsFirstAt)}
                />
                <TextField
                    label="Then a star every ($)"
                    inputMode="decimal"
                    value={every}
                    onChange={setEvery}
                    placeholder={String(defaults.starsEvery)}
                />
                <TextField
                    label="Running low at"
                    inputMode="numeric"
                    value={lowAt}
                    onChange={setLowAt}
                    placeholder={String(defaults.lowStockAt)}
                />
            </div>

            {resetting && (
                <ConfirmationModal
                    title="Go back to the default levels"
                    message={`First star at ${FormatCurrency(defaults.starsFirstAt)}, then every ${FormatCurrency(
                        defaults.starsEvery
                    )}, and running low at ${defaults.lowStockAt}?`}
                    confirmText="Use the defaults"
                    onConfirm={handleReset}
                    onCancel={() => setResetting(false)}
                />
            )}
        </SettingsCard>
    );
};

export default DashboardSettings;
