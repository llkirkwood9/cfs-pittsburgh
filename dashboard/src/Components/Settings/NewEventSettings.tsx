import { useEffect, useState } from "react";
import TextField from "../Elements/TextField";
import SettingsCard from "./SettingsCard";
import { useSettingsScope } from "./SettingsScope";
import { Toast } from "../../Lib/Toast";
import { DefaultGeneralSettings } from "../../Models/GeneralSettings";
import { SaveGeneralSettings } from "../../Services/SettingsServices";

/** Matches the server's limit: 25%, to catch a rate typed in the wrong box. */
const MAX_PERCENT = 25;

const hint = "text-xs text-zinc-500 dark:text-zinc-400";

/** A rate as the percent people type, e.g. 0.07 as "7". */
const AsPercent = (rate: number) => String(Number((rate * 100).toFixed(4)));

/** A typed percent as a rate, or NaN. */
const AsRate = (percent: string) => Number(percent.replace(/[%\s]/g, "")) / 100;

/**
 * The sales tax and card processing fee a new event starts with. Each event's own rates are still
 * changed on the Events screen; these just save typing them in every time.
 */
const NewEventSettings = () => {
    const { settings, apply, territoryId } = useSettingsScope();
    const defaults = settings.defaults ?? DefaultGeneralSettings;

    const [tax, setTax] = useState<string>(AsPercent(settings.defaultSalesTaxRate));
    const [fee, setFee] = useState<string>(AsPercent(settings.defaultCcProcessingFeeRate));
    const [saving, setSaving] = useState<boolean>(false);

    useEffect(() => {
        setTax(AsPercent(settings.defaultSalesTaxRate));
        setFee(AsPercent(settings.defaultCcProcessingFeeRate));
    }, [settings.defaultSalesTaxRate, settings.defaultCcProcessingFeeRate]);

    const taxRate = AsRate(tax);
    const feeRate = AsRate(fee);
    const ok = (rate: number) => Number.isFinite(rate) && rate >= 0 && rate <= MAX_PERCENT / 100;

    // Compared as typed percents so 7 and 7.0 aren't seen as a change.
    const dirty =
        AsPercent(taxRate) !== AsPercent(settings.defaultSalesTaxRate) ||
        AsPercent(feeRate) !== AsPercent(settings.defaultCcProcessingFeeRate);
    const isDefault =
        settings.defaultSalesTaxRate === defaults.defaultSalesTaxRate &&
        settings.defaultCcProcessingFeeRate === defaults.defaultCcProcessingFeeRate;

    const save = async (values: {
        defaultSalesTaxRate: number;
        defaultCcProcessingFeeRate: number;
    }) => {
        setSaving(true);
        const result = await SaveGeneralSettings(values, territoryId);
        setSaving(false);
        if (!result) return false;
        apply(result);
        return true;
    };

    const handleSave = async () => {
        if (!ok(taxRate) || !ok(feeRate) || !tax.trim() || !fee.trim())
            return Toast.Warning(`Enter each rate as a percent from 0 to ${MAX_PERCENT}.`);
        if (
            await save({
                defaultSalesTaxRate: Number(taxRate.toFixed(6)),
                defaultCcProcessingFeeRate: Number(feeRate.toFixed(6)),
            })
        )
            Toast.Success("New event defaults saved.");
    };

    const handleReset = async () => {
        if (
            await save({
                defaultSalesTaxRate: defaults.defaultSalesTaxRate,
                defaultCcProcessingFeeRate: defaults.defaultCcProcessingFeeRate,
            })
        )
            Toast.Success("New event defaults are back to 7% tax and a 2% card fee.");
    };

    return (
        <SettingsCard
            id="events"
            title="New events"
            icon="fa-solid fa-calendar-plus"
            description="The rates a new event starts with. Each event's own rates can still be changed on the Events screen."
            status={isDefault ? "Using the default rates." : "Using your own rates."}
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onDiscard={() => {
                setTax(AsPercent(settings.defaultSalesTaxRate));
                setFee(AsPercent(settings.defaultCcProcessingFeeRate));
            }}
            onReset={isDefault ? undefined : handleReset}
        >
            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <TextField
                        label="Sales tax (%)"
                        inputMode="decimal"
                        value={tax}
                        onChange={setTax}
                        placeholder={AsPercent(defaults.defaultSalesTaxRate)}
                    />
                    <p className={`mt-1 ${hint}`}>Charged on taxable items.</p>
                </div>
                <div>
                    <TextField
                        label="Card processing fee (%)"
                        inputMode="decimal"
                        value={fee}
                        onChange={setFee}
                        placeholder={AsPercent(defaults.defaultCcProcessingFeeRate)}
                    />
                    <p className={`mt-1 ${hint}`}>
                        Added to the part of a sale paid by credit or debit card.
                    </p>
                </div>
            </div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                Events already set up keep their own rates.
            </p>
        </SettingsCard>
    );
};

export default NewEventSettings;
