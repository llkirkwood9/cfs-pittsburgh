import { useEffect, useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import SettingsCard from "./SettingsCard";
import { useSettings } from "../../Context/SettingsContext";
import { Toast } from "../../Lib/Toast";
import { SaveGeneralSettings } from "../../Services/SettingsServices";

/** Matches the server's limits. */
const MAX_OPTIONS = 20;
const MAX_LENGTH = 60;

const hint = "text-xs text-zinc-500 dark:text-zinc-400";

/** The list as it would be saved: trimmed, no blanks, no repeats. */
const Tidy = (options: string[]): string[] =>
    options
        .map((o) => o.trim())
        .filter(
            (o, i, all) =>
                o !== "" && all.findIndex((x) => x.toLowerCase() === o.toLowerCase()) === i
        );

/**
 * The kinds of financing offered, such as "12 months no interest". Checkout picks one when a sale
 * is financed, along with the financing number, and both print in the sales sheet's comments.
 * With none set, checkout types the kind in.
 */
const FinanceSettings = () => {
    const { settings, apply } = useSettings();
    const saved = settings.financeOptions ?? [];

    const [options, setOptions] = useState<string[]>(saved);
    const [saving, setSaving] = useState<boolean>(false);

    useEffect(() => {
        setOptions(settings.financeOptions ?? []);
    }, [settings.financeOptions]);

    const dirty = JSON.stringify(Tidy(options)) !== JSON.stringify(saved);

    const setOption = (index: number, value: string) =>
        setOptions((rows) => rows.map((row, i) => (i === index ? value : row)));

    const move = (index: number, by: number) =>
        setOptions((rows) => {
            const next = [...rows];
            const [row] = next.splice(index, 1);
            next.splice(index + by, 0, row);
            return next;
        });

    const handleSave = async () => {
        const tidy = Tidy(options);
        if (tidy.length > MAX_OPTIONS)
            return Toast.Warning(`There can be at most ${MAX_OPTIONS} finance options.`);
        if (tidy.some((o) => o.length > MAX_LENGTH))
            return Toast.Warning(`Each finance option can be at most ${MAX_LENGTH} characters.`);

        setSaving(true);
        const result = await SaveGeneralSettings({ financeOptions: tidy });
        setSaving(false);
        if (!result) return;
        apply(result);
        Toast.Success("Finance options saved.");
    };

    return (
        <SettingsCard
            id="financing"
            title="Financing"
            icon="fa-solid fa-file-invoice-dollar"
            description="The kinds of financing a customer can choose. Checkout picks one, and enters the financing number, when a sale is financed; both print in the sales sheet's comments."
            status={
                saved.length === 0
                    ? "No finance options yet - checkout types the kind of financing in."
                    : `${saved.length} finance option${saved.length === 1 ? "" : "s"}.`
            }
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onDiscard={() => setOptions(saved)}
        >
            <ul className="space-y-2">
                {options.map((option, index) => (
                    <li key={index} className="flex items-center gap-2">
                        <input
                            value={option}
                            onChange={(e) => setOption(index, e.target.value)}
                            maxLength={MAX_LENGTH}
                            placeholder="e.g. 12 months no interest"
                            aria-label={`Finance option ${index + 1}`}
                            className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-base
                                text-zinc-900 outline-none focus:border-sky-600
                                dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <button
                            type="button"
                            onClick={() => move(index, -1)}
                            disabled={index === 0}
                            aria-label="Move up"
                            className="flex h-12 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100
                                disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                            <Icon icon="fa-solid fa-arrow-up" />
                        </button>
                        <button
                            type="button"
                            onClick={() => move(index, 1)}
                            disabled={index === options.length - 1}
                            aria-label="Move down"
                            className="flex h-12 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100
                                disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                            <Icon icon="fa-solid fa-arrow-down" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setOptions((rows) => rows.filter((_, i) => i !== index))}
                            aria-label="Remove finance option"
                            className="flex h-12 w-10 items-center justify-center rounded-lg text-red-700
                                hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                            <Icon icon="fa-solid fa-trash" />
                        </button>
                    </li>
                ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                    text="Add finance option"
                    icon="fa-solid fa-plus"
                    onClick={() => setOptions((rows) => [...rows, ""])}
                    disabled={options.length >= MAX_OPTIONS}
                    className="min-h-[40px] px-3 text-sm"
                />
                <p className={hint}>Listed for checkout in this order.</p>
            </div>
        </SettingsCard>
    );
};

export default FinanceSettings;
