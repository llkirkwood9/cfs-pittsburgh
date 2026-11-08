import TextField from "../Elements/TextField";
import SettingsCard from "./SettingsCard";
import { useNewEventSettings } from "@shared/Hooks/useSettingsCard";
import { RateAsPercent } from "@shared/Lib/Format";

/**
 * The sales tax and card processing fee a new event starts with. Each event's own rates are still
 * changed on the Events screen; these just save typing them in every time.
 */
const NewEventSettings = () => {
    const card = useNewEventSettings();
    const { draft, defaults } = card;

    return (
        <SettingsCard
            id="events"
            title="New events"
            icon="fa-solid fa-calendar-plus"
            description="The rates a new event starts with."
            status={card.isDefault ? "Using the default rates." : "Using your own rates."}
            dirty={card.dirty}
            saving={card.saving}
            onSave={card.handleSave}
            onDiscard={card.discard}
            onReset={card.isDefault ? undefined : card.handleReset}
        >
            <div className="grid gap-4 md:grid-cols-2">
                <TextField
                    label="Sales tax (%)"
                    inputMode="decimal"
                    value={draft.tax}
                    onChange={(value) => card.change({ tax: value })}
                    placeholder={RateAsPercent(defaults.defaultSalesTaxRate)}
                />
                <TextField
                    label="Card processing fee (%)"
                    inputMode="decimal"
                    value={draft.fee}
                    onChange={(value) => card.change({ fee: value })}
                    placeholder={RateAsPercent(defaults.defaultCcProcessingFeeRate)}
                />
            </div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                Events already set up keep their own rates.
            </p>
        </SettingsCard>
    );
};

export default NewEventSettings;
