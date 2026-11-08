import { useRef } from "react";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Icon from "../Elements/Icon";
import ListSkeleton from "../Elements/ListSkeleton";
import SettingsCard from "./SettingsCard";
import { FormatDateTime } from "@shared/Lib/Format";
import { useSettingsScope } from "@shared/Context/SettingsScope";
import { useSettingsReceiptEmail } from "@shared/Hooks/useSettingsReceiptEmail";
import type { ReceiptEmailField } from "@shared/Hooks/useSettingsReceiptEmail";

const label =
    "flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
const field =
    "w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-hidden transition-colors focus:border-sky-600 focus:ring-2 focus:ring-sky-600/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-sky-500";

/**
 * The subject and wording of the email that goes with a customer's emailed receipt, with a live
 * preview for a sample order.
 */
const ReceiptEmailSettings = () => {
    const { settings: general } = useSettingsScope();
    const email = useSettingsReceiptEmail();
    const { saved, subject, body, maxSubject, maxBody, preview, unknown, resetting } = email;
    const subjectRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLTextAreaElement>(null);
    // Where a tapped placeholder goes: the field used last.
    const target = useRef<ReceiptEmailField>("body");

    if (email.loading) {
        return (
            <section className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
                <ListSkeleton rows={3} />
            </section>
        );
    }

    if (!saved) {
        return (
            <section className="rounded-xl bg-white p-4 text-sm shadow-xs dark:bg-zinc-800">
                The receipt email settings couldn&apos;t be loaded.
            </section>
        );
    }

    // Puts a placeholder where the cursor is in the field used last, and leaves the cursor after it.
    const insert = (name: string) => {
        const which = target.current;
        const el = which === "subject" ? subjectRef.current : bodyRef.current;
        const length = (which === "subject" ? subject : body).length;
        const caret = email.insert(which, name, {
            start: el?.selectionStart ?? length,
            end: el?.selectionEnd ?? length,
        });
        if (caret === null) return;
        requestAnimationFrame(() => {
            el?.focus();
            el?.setSelectionRange(caret, caret);
        });
    };

    return (
        <SettingsCard
            id="receipt-email"
            title="Receipt email"
            icon="fa-solid fa-envelope"
            description="The message sent with an emailed receipt."
            badge={
                <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        saved.isDefault
                            ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                            : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
                    }`}
                >
                    <Icon icon={saved.isDefault ? "fa-solid fa-file-lines" : "fa-solid fa-pen"} />
                    {saved.isDefault ? "Default wording" : "Custom wording"}
                </span>
            }
            status={
                saved.isDefault
                    ? "Using the default wording."
                    : `Last changed${saved.updatedBy ? ` by ${saved.updatedBy}` : ""}${
                          saved.updatedAt ? ` on ${FormatDateTime(saved.updatedAt)}` : ""
                      }.`
            }
            dirty={email.dirty}
            saving={email.saving}
            onSave={email.handleSave}
            onDiscard={email.discard}
            onReset={saved.isDefault ? undefined : () => email.setResetting(true)}
        >
            <div className="grid gap-4 lg:grid-cols-2">
                {/* Editor */}
                <div className="min-w-0">
                    <label className="flex flex-col gap-1">
                        <span className={label}>Subject</span>
                        <input
                            ref={subjectRef}
                            value={subject}
                            onChange={(e) => email.setSubject(e.target.value)}
                            onFocus={() => (target.current = "subject")}
                            maxLength={maxSubject}
                            className={`${field} min-h-[48px]`}
                        />
                    </label>

                    <label className="mt-3 flex flex-col gap-1">
                        <span className={label}>
                            Message
                            <span className="font-normal normal-case tabular-nums">
                                {body.length.toLocaleString()} / {maxBody.toLocaleString()}
                            </span>
                        </span>
                        <textarea
                            ref={bodyRef}
                            value={body}
                            onChange={(e) => email.setBody(e.target.value)}
                            onFocus={() => (target.current = "body")}
                            maxLength={maxBody}
                            rows={14}
                            spellCheck
                            className={`${field} py-2 leading-relaxed`}
                        />
                    </label>

                    {unknown.length > 0 && (
                        <p className="mt-2 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                            <Icon icon="fa-solid fa-triangle-exclamation" className="mt-0.5" />
                            <span>
                                {unknown.map((u) => `{${u}}`).join(", ")}{" "}
                                {unknown.length === 1
                                    ? "isn't a placeholder"
                                    : "aren't placeholders"}{" "}
                                the app knows, so {unknown.length === 1 ? "it" : "they"} will be
                                sent exactly as typed. Check the spelling against the list below.
                            </span>
                        </p>
                    )}

                    <div className="mt-3">
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Insert a placeholder
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {(saved.placeholders ?? []).map((p) => (
                                <button
                                    key={p.name}
                                    type="button"
                                    // Keep the cursor where it is in the field being edited.
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => insert(p.name ?? "")}
                                    title={p.description}
                                    className="min-h-[36px] rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 font-mono text-xs
                                        text-zinc-800 hover:border-sky-600 hover:bg-sky-50
                                        dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-sky-950/40"
                                >
                                    {`{${p.name}}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <details className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900/40">
                        <summary className="cursor-pointer font-semibold">
                            How the message is laid out
                        </summary>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
                            <li>Leave a blank line between paragraphs.</li>
                            <li>Start lines with &quot;- &quot; to make a bulleted list.</li>
                            <li>Tap a placeholder above to add it.</li>
                            <li>Put {"{WhatHappensNext}"} on its own line for the next steps.</li>
                        </ul>
                        <dl className="mt-3 space-y-1.5">
                            {(saved.placeholders ?? []).map((p) => (
                                <div key={p.name}>
                                    <dt className="inline font-mono text-xs font-semibold">
                                        {`{${p.name}}`}
                                    </dt>{" "}
                                    <dd className="inline text-zinc-600 dark:text-zinc-400">
                                        {p.description}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </details>
                </div>

                {/* Preview */}
                <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Preview for a sample order
                    </p>
                    <div className="overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-600">
                        <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
                            <span className="block">
                                <span className="text-zinc-500 dark:text-zinc-400">From: </span>
                                {general.appName}
                            </span>
                            <span className="block">
                                <span className="text-zinc-500 dark:text-zinc-400">Subject: </span>
                                <span className="font-semibold">{preview?.subject}</span>
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                <Icon icon="fa-solid fa-paperclip" />
                                {preview?.attachmentName ?? "CFS-Receipt.pdf"}
                            </span>
                        </div>
                        {/* Shown as an email app would, on white, in a sandbox: it can't run anything. */}
                        <iframe
                            title="Receipt email preview"
                            sandbox=""
                            srcDoc={`<!doctype html><html><body style="margin:16px;background:#fff">${preview?.html ?? ""}</body></html>`}
                            className="block h-[520px] w-full bg-white"
                        />
                    </div>
                </div>
            </div>

            {resetting && (
                <ConfirmationModal
                    title="Go back to the default wording"
                    message="Replace the receipt email's subject and message with the default wording? Your current wording will be lost."
                    confirmText="Use the default"
                    onConfirm={email.handleReset}
                    onCancel={() => email.setResetting(false)}
                />
            )}
        </SettingsCard>
    );
};

export default ReceiptEmailSettings;
