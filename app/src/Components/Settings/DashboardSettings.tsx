import SettingsCard from "./SettingsCard";
import { useDashboardSettings } from "@shared/Hooks/useSettingsCard";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Grid from "../Elements/Grid";
import TextField from "../Elements/TextField";
import { FormatCurrency } from "@shared/Lib/Format";

type Props = {
    onLayout?: (id: string, y: number) => void;
};

/**
 * The dashboard's levels: when the Net sales tile earns its stars, and how few of a counted item
 * is "running low" on the dashboard and the Inventory screen.
 */
const DashboardSettings = ({ onLayout }: Props) => {
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
            onLayout={onLayout}
        >
            <Grid columns={{ base: 1, md: 3 }} gap={16}>
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
            </Grid>

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
