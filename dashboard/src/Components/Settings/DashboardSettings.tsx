import ConfirmationModal from "../Elements/ConfirmationModal";
import TextField from "../Elements/TextField";
import SettingsCard from "./SettingsCard";
import { useDashboardSettings } from "@shared/Hooks/useSettingsCard";
import { FormatCurrency } from "@shared/Lib/Format";

/**
 * The dashboard's levels: when the Net sales tile earns its stars, and how few of a counted item
 * is "running low" on the dashboard and the Inventory screen.
 */
const DashboardSettings = () => {
    const card = useDashboardSettings();
    const { draft, defaults } = card;

    return (
        <SettingsCard
            id="dashboard"
            title="Dashboard"
            icon="fa-solid fa-chart-column"
            description="Net sales stars and the running-low level."
            status={card.isDefault ? "Using the default levels." : "Using your own levels."}
            dirty={card.dirty}
            saving={card.saving}
            onSave={card.handleSave}
            onDiscard={card.discard}
            onReset={card.isDefault ? undefined : () => card.setResetting(true)}
        >
            <div className="grid gap-4 md:grid-cols-3">
                <TextField
                    label="First star at ($)"
                    inputMode="decimal"
                    value={draft.firstAt}
                    onChange={(value) => card.change({ firstAt: value })}
                    placeholder={String(defaults.starsFirstAt)}
                />
                <TextField
                    label="Then a star every ($)"
                    inputMode="decimal"
                    value={draft.every}
                    onChange={(value) => card.change({ every: value })}
                    placeholder={String(defaults.starsEvery)}
                />
                <TextField
                    label="Running low at"
                    inputMode="numeric"
                    value={draft.lowAt}
                    onChange={(value) => card.change({ lowAt: value })}
                    placeholder={String(defaults.lowStockAt)}
                />
            </div>

            {card.resetting && (
                <ConfirmationModal
                    title="Go back to the default levels"
                    message={`First star at ${FormatCurrency(defaults.starsFirstAt)}, then every ${FormatCurrency(
                        defaults.starsEvery
                    )}, and running low at ${defaults.lowStockAt}?`}
                    confirmText="Use the defaults"
                    onConfirm={card.handleReset}
                    onCancel={() => card.setResetting(false)}
                />
            )}
        </SettingsCard>
    );
};

export default DashboardSettings;
