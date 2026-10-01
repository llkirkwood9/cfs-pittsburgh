import { useEffect, useRef, useState } from "react";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import { FormatDateTime } from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import type { ReceiptEmailPreview, ReceiptEmailSettings } from "../Models/ReceiptEmailSettings";
import {
    GetReceiptEmailSettings,
    PreviewReceiptEmail,
    SaveReceiptEmailSettings,
} from "../Services/SettingsServices";

/** How long typing has to pause before the preview refreshes. */
const PREVIEW_DELAY_MS = 400;

/**
 * Settings an administrator changes for everyone. For now: the wording of the email that goes
 * with a customer's emailed receipt, with a live preview for a sample order.
 */
const SettingsPage = () => {
    const [settings, setSettings] = useState<ReceiptEmailSettings | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [body, setBody] = useState<string>("");
    const [preview, setPreview] = useState<ReceiptEmailPreview | null>(null);
    const [saving, setSaving] = useState<boolean>(false);
    const [resetting, setResetting] = useState<boolean>(false);
    const editor = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const load = async () => {
            const found = await GetReceiptEmailSettings();
            setSettings(found);
            setBody(found?.body ?? "");
            setLoading(false);
        };
        load();
    }, []);

    // Refresh the preview once typing pauses. A newer request supersedes an older one.
    useEffect(() => {
        if (loading) return;
        let current = true;
        const timer = setTimeout(async () => {
            const result = await PreviewReceiptEmail(body);
            if (current && result) setPreview(result);
        }, PREVIEW_DELAY_MS);
        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [body, loading]);

    if (loading) {
        return (
            <div className="mx-auto max-w-6xl p-4">
                <ListSkeleton rows={4} />
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="p-8 text-center">
                <p className="text-base font-semibold">The settings couldn&apos;t be loaded.</p>
            </div>
        );
    }

    const saved = settings.body ?? "";
    const dirty = body !== saved;
    const max = settings.maxLength ?? 5000;
    const unknown = preview?.unknownPlaceholders ?? [];

    // Puts a placeholder where the cursor is, and leaves the cursor just after it.
    const insert = (name: string) => {
        const token = `{${name}}`;
        const area = editor.current;
        const start = area?.selectionStart ?? body.length;
        const end = area?.selectionEnd ?? body.length;
        const next = body.slice(0, start) + token + body.slice(end);
        if (next.length > max) return Toast.Warning("The email is as long as it can be.");
        setBody(next);
        requestAnimationFrame(() => {
            area?.focus();
            area?.setSelectionRange(start + token.length, start + token.length);
        });
    };

    const save = async (value: string) => {
        setSaving(true);
        const result = await SaveReceiptEmailSettings(value);
        setSaving(false);
        if (!result) return false;
        setSettings(result);
        setBody(result.body ?? "");
        return true;
    };

    const handleSave = async () => {
        if (!body.trim()) return setResetting(true);
        if (await save(body)) Toast.Success("Receipt email saved.");
    };

    const handleReset = async () => {
        setResetting(false);
        if (await save("")) Toast.Success("Receipt email is back to the default wording.");
    };

    return (
        <div className="mx-auto max-w-6xl p-3 sm:p-4">
            <h1 className="mb-1 text-xl font-bold">Settings</h1>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                These apply to everyone using the app.
            </p>

            <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold">Receipt email</h2>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            The message customers get when their receipt is emailed. The receipt
                            itself is attached as a PDF.
                        </p>
                    </div>
                    <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            settings.isDefault
                                ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
                        }`}
                    >
                        <Icon
                            icon={settings.isDefault ? "fa-solid fa-file-lines" : "fa-solid fa-pen"}
                        />
                        {settings.isDefault ? "Default wording" : "Custom wording"}
                    </span>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    {/* Editor */}
                    <div className="min-w-0">
                        <label className="flex flex-col gap-1">
                            <span className="flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Message
                                <span className="font-normal normal-case tabular-nums">
                                    {body.length.toLocaleString()} / {max.toLocaleString()}
                                </span>
                            </span>
                            <textarea
                                ref={editor}
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                maxLength={max}
                                rows={16}
                                spellCheck
                                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base leading-relaxed
                                    text-zinc-900 outline-none transition-colors
                                    focus:border-sky-600 focus:ring-2 focus:ring-sky-600/30
                                    dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-sky-500"
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
                                    sent exactly as typed. Check the spelling against the list
                                    below.
                                </span>
                            </p>
                        )}

                        <div className="mt-3">
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Insert a placeholder
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {(settings.placeholders ?? []).map((p) => (
                                    <button
                                        key={p.name}
                                        type="button"
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
                                <li>
                                    Placeholders in curly braces are filled in for each order. Tap
                                    one above to add it where the cursor is.
                                </li>
                                <li>
                                    Put {"{WhatHappensNext}"} on a line of its own for the
                                    &quot;What happens next&quot; list. It only lists what applies
                                    to that order, and disappears when nothing does.
                                </li>
                            </ul>
                            <dl className="mt-3 space-y-1.5">
                                {(settings.placeholders ?? []).map((p) => (
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
                                <span className="text-zinc-500 dark:text-zinc-400">Subject: </span>
                                <span className="font-semibold">{preview?.subject}</span>
                                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                    <Icon icon="fa-solid fa-paperclip" />
                                    CFS-Receipt-
                                    {preview?.subject?.match(/#(\d+)/)?.[1] ?? "1001"}.pdf
                                </span>
                            </div>
                            {/* Shown as an email app would, on white, in a sandbox: it can't run anything. */}
                            <iframe
                                title="Receipt email preview"
                                sandbox=""
                                srcDoc={`<!doctype html><html><body style="margin:16px;background:#fff">${preview?.html ?? ""}</body></html>`}
                                className="block h-[480px] w-full bg-white"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                    <p className="mr-auto text-xs text-zinc-500 dark:text-zinc-400">
                        {dirty
                            ? "You have unsaved changes."
                            : settings.isDefault
                              ? "Using the default wording."
                              : `Last changed${settings.updatedBy ? ` by ${settings.updatedBy}` : ""}${
                                    settings.updatedAt
                                        ? ` on ${FormatDateTime(settings.updatedAt)}`
                                        : ""
                                }.`}
                    </p>
                    {!settings.isDefault && (
                        <Button
                            text="Reset to default"
                            icon="fa-solid fa-rotate-left"
                            onClick={() => setResetting(true)}
                            disabled={saving}
                            className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                    )}
                    {dirty && (
                        <Button
                            text="Discard changes"
                            icon="fa-solid fa-xmark"
                            onClick={() => setBody(saved)}
                            disabled={saving}
                            className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                    )}
                    <Button
                        text={saving ? "Saving..." : "Save"}
                        icon="fa-solid fa-floppy-disk"
                        onClick={handleSave}
                        loading={saving}
                        disabled={!dirty}
                        className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                    />
                </div>
            </section>

            {resetting && (
                <ConfirmationModal
                    title="Go back to the default wording"
                    message="Replace the receipt email with the default wording? Your current wording will be lost."
                    confirmText="Use the default"
                    onConfirm={handleReset}
                    onCancel={() => setResetting(false)}
                />
            )}
        </div>
    );
};

export default SettingsPage;
