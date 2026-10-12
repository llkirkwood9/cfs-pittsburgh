import { useEffect, useState } from "react";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Icon from "../Elements/Icon";
import TermText from "../Elements/TermText";
import TextField from "../Elements/TextField";
import SettingsCard from "./SettingsCard";
import { useSettings } from "../../Context/SettingsContext";
import { Toast } from "../../Lib/Toast";
import { DefaultSalesTerms } from "../../Models/GeneralSettings";
import type { SalesTerm } from "../../Models/GeneralSettings";
import { SaveGeneralSettings } from "../../Services/SettingsServices";

/** Matches the server's limits. */
const MAX_TEXT = 1200;
const MAX_HEADING = 60;

const hint = "text-xs text-zinc-500 dark:text-zinc-400";

const same = (a: SalesTerm[], b: SalesTerm[]) =>
    a.length === b.length &&
    a.every(
        (t, i) =>
            t.key === b[i].key &&
            t.title.trim() === b[i].title &&
            t.heading.trim() === b[i].heading &&
            t.text.trim() === b[i].text
    );

/**
 * The four statements a customer initials. Each paragraph is printed on the sales sheet beside
 * its INITIAL line and shown, word for word, on the customer's initialling screen.
 */
const TermsSettings = () => {
    const { settings, apply } = useSettings();
    const defaults = settings.defaults?.terms ?? DefaultSalesTerms;

    const [terms, setTerms] = useState<SalesTerm[]>(settings.terms);
    const [saving, setSaving] = useState<boolean>(false);
    const [resetting, setResetting] = useState<boolean>(false);

    useEffect(() => {
        setTerms(settings.terms);
    }, [settings.terms]);

    const dirty = !same(terms, settings.terms);
    const isDefault = same(settings.terms, defaults);

    const change = (key: string, field: keyof SalesTerm, value: string) =>
        setTerms((current) => current.map((t) => (t.key === key ? { ...t, [field]: value } : t)));

    const save = async (next: SalesTerm[]) => {
        setSaving(true);
        const result = await SaveGeneralSettings({
            terms: next.map((t) => ({
                ...t,
                title: t.title.trim(),
                heading: t.heading.trim(),
                text: t.text.trim(),
            })),
        });
        setSaving(false);
        if (!result) return false;
        apply(result);
        return true;
    };

    const handleSave = async () => {
        const empty = terms.find((t) => !t.text.trim());
        if (empty)
            return Toast.Warning(`"${empty.title}" needs its paragraph - customers initial it.`);
        if (await save(terms)) Toast.Success("Sales sheet terms saved.");
    };

    const handleReset = async () => {
        setResetting(false);
        if (await save(defaults))
            Toast.Success("Sales sheet terms are back to the paper form's wording.");
    };

    return (
        <SettingsCard
            id="terms"
            title="Sales sheet terms"
            icon="fa-solid fa-file-signature"
            description="The statements customers initial. Each paragraph prints on the sales sheet beside its INITIAL line, and the customer reads the same words on their initialling screen."
            status={isDefault ? "Using the paper form's wording." : "Using your own wording."}
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onDiscard={() => setTerms(settings.terms)}
            onReset={isDefault ? undefined : () => setResetting(true)}
        >
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                <Icon icon="fa-solid fa-circle-info" className="mt-0.5" />
                <span>
                    Put <code className="font-mono">**two stars**</code> around words to make them{" "}
                    <strong>bold</strong>, and{" "}
                    <code className="font-mono">__two underscores__</code> to <u>underline</u> them.
                    Completed sales keep the wording the customer initialled, so changing it here
                    never changes a sheet already signed.
                </span>
            </p>

            <div className="space-y-4">
                {terms.map((t, index) => {
                    const fallback = defaults.find((d) => d.key === t.key);
                    return (
                        <fieldset
                            key={t.key}
                            className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
                        >
                            <legend className="px-1 text-sm font-semibold">
                                {index + 1}. {t.title || fallback?.title}
                            </legend>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <TextField
                                        label="Title on the customer's screen"
                                        value={t.title}
                                        onChange={(v) => change(t.key, "title", v)}
                                        maxLength={MAX_HEADING}
                                        placeholder={fallback?.title}
                                    />
                                </div>
                                <div>
                                    <TextField
                                        label="Heading on the sales sheet"
                                        value={t.heading}
                                        onChange={(v) => change(t.key, "heading", v)}
                                        maxLength={MAX_HEADING}
                                        placeholder="None"
                                    />
                                    <p className={`mt-1 ${hint}`}>
                                        Printed bold and underlined before the paragraph. Leave
                                        blank for none.
                                    </p>
                                </div>
                            </div>
                            <label className="mt-3 flex flex-col gap-1">
                                <span className="flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Paragraph
                                    <span className="font-normal normal-case tabular-nums">
                                        {t.text.length.toLocaleString()} /{" "}
                                        {MAX_TEXT.toLocaleString()}
                                    </span>
                                </span>
                                <textarea
                                    value={t.text}
                                    onChange={(e) => change(t.key, "text", e.target.value)}
                                    maxLength={MAX_TEXT}
                                    rows={t.text.length > 300 ? 6 : 3}
                                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base leading-relaxed
                                        text-zinc-900 outline-hidden transition-colors
                                        focus:border-sky-600 focus:ring-2 focus:ring-sky-600/30
                                        dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-sky-500"
                                />
                            </label>
                            <div className="mt-2">
                                <p className={`mb-1 ${hint} font-semibold uppercase tracking-wide`}>
                                    As printed on the sales sheet
                                </p>
                                <p className="rounded-lg border border-zinc-200 bg-white p-2 font-serif text-[13px] leading-snug text-black dark:border-zinc-700">
                                    {t.heading.trim() && (
                                        <>
                                            <span className="font-bold underline">
                                                {t.heading.trim()}:
                                            </span>{" "}
                                        </>
                                    )}
                                    <TermText text={t.text} />{" "}
                                    <span className="font-bold">
                                        INITIAL{" "}
                                        <span className="inline-block min-w-[3em] border-b border-black" />
                                    </span>
                                </p>
                            </div>
                        </fieldset>
                    );
                })}
            </div>

            {resetting && (
                <ConfirmationModal
                    title="Go back to the paper form's wording"
                    message="Replace all four statements with the wording from the paper sales sheet? Completed sales keep the wording they were signed with."
                    confirmText="Use the default wording"
                    onConfirm={handleReset}
                    onCancel={() => setResetting(false)}
                />
            )}
        </SettingsCard>
    );
};

export default TermsSettings;
