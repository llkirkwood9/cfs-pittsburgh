import ConfirmationModal from "../Elements/ConfirmationModal";
import Icon from "../Elements/Icon";
import TermText from "../Elements/TermText";
import TextField from "../Elements/TextField";
import SettingsCard from "./SettingsCard";
import { useTermsSettings } from "@shared/Hooks/useSettingsCard";
import { TermsLimits } from "@shared/Lib/SettingsCards";
import { AskWhenOptions } from "@shared/Models/GeneralSettings";
import type { AskWhen } from "@shared/Models/GeneralSettings";

const hint = "text-xs text-zinc-500 dark:text-zinc-400";

/**
 * The four statements a customer initials. Each paragraph is printed on the sales sheet beside
 * its INITIAL line and shown, word for word, on the customer's initialling screen.
 */
const TermsSettings = () => {
    const card = useTermsSettings();
    const { draft: terms, defaultTerms: defaults, changeTerm: change } = card;

    return (
        <SettingsCard
            id="terms"
            title="Sales sheet terms"
            icon="fa-solid fa-file-signature"
            description="The statements customers initial."
            status={card.isDefault ? "Using the paper form's wording." : "Using your own wording."}
            dirty={card.dirty}
            saving={card.saving}
            onSave={card.handleSave}
            onDiscard={card.discard}
            onReset={card.isDefault ? undefined : () => card.setResetting(true)}
        >
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                <Icon icon="fa-solid fa-circle-info" className="mt-0.5" />
                <span>
                    <code className="font-mono">**two stars**</code> for <strong>bold</strong>,{" "}
                    <code className="font-mono">__two underscores__</code> to <u>underline</u>.
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
                            <div className="grid gap-3 md:grid-cols-3">
                                <div>
                                    <TextField
                                        label="Title on the customer's screen"
                                        value={t.title}
                                        onChange={(v) => change(t.key, "title", v)}
                                        maxLength={TermsLimits.heading}
                                        placeholder={fallback?.title}
                                    />
                                </div>
                                <div>
                                    <TextField
                                        label="Heading on the sales sheet"
                                        value={t.heading}
                                        onChange={(v) => change(t.key, "heading", v)}
                                        maxLength={TermsLimits.heading}
                                        placeholder="None"
                                    />
                                </div>
                                {/* A statement that doesn't apply to an order is skipped and prints N/A. */}
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                        Ask the customer
                                    </span>
                                    <select
                                        value={t.askWhen ?? "always"}
                                        onChange={(e) =>
                                            change(t.key, "askWhen", e.target.value as AskWhen)
                                        }
                                        className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base
                                            text-zinc-900 outline-hidden focus:border-sky-600
                                            dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                    >
                                        {AskWhenOptions.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <label className="mt-3 flex flex-col gap-1">
                                <span className="flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Paragraph
                                    <span className="font-normal normal-case tabular-nums">
                                        {t.text.length.toLocaleString()} /{" "}
                                        {TermsLimits.text.toLocaleString()}
                                    </span>
                                </span>
                                <textarea
                                    value={t.text}
                                    onChange={(e) => change(t.key, "text", e.target.value)}
                                    maxLength={TermsLimits.text}
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

            {card.resetting && (
                <ConfirmationModal
                    title="Go back to the paper form's wording"
                    message="Replace all four statements with the wording from the paper sales sheet? Completed sales keep the wording they were signed with."
                    confirmText="Use the default wording"
                    onConfirm={card.handleReset}
                    onCancel={() => card.setResetting(false)}
                />
            )}
        </SettingsCard>
    );
};

export default TermsSettings;
