import { useEffect, useState } from "react";
import { Toast } from "@host";
import { useSettingsScope } from "../Context/SettingsScope";
import { InsertPlaceholder } from "../Lib/SettingsCards";
import type {
    ReceiptEmailPreview,
    ReceiptEmailSettings as ReceiptEmail,
} from "../Models/ReceiptEmailSettings";
import {
    GetReceiptEmailSettings,
    PreviewReceiptEmail,
    SaveReceiptEmailSettings,
} from "../Services/SettingsServices";

/** How long typing has to pause before the preview refreshes. */
const PREVIEW_DELAY_MS = 400;

/** One of the receipt email's two fields. */
export type ReceiptEmailField = "subject" | "body";

/**
 * The Receipt email card: the saved wording, the subject and body being edited, a live preview
 * for a sample order, and saving or going back to the default wording.
 * @returns The state and handlers.
 */
export const useSettingsReceiptEmail = () => {
    const { settings: general, territoryId } = useSettingsScope();
    const [saved, setSaved] = useState<ReceiptEmail | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [subject, setSubject] = useState<string>("");
    const [body, setBody] = useState<string>("");
    const [preview, setPreview] = useState<ReceiptEmailPreview | null>(null);
    const [saving, setSaving] = useState<boolean>(false);
    const [resetting, setResetting] = useState<boolean>(false);

    useEffect(() => {
        const load = async () => {
            const found = await GetReceiptEmailSettings(territoryId);
            setSaved(found);
            setSubject(found?.subject ?? "");
            setBody(found?.body ?? "");
            setLoading(false);
        };
        load();
    }, [territoryId]);

    // Refresh the preview once typing pauses, or when the business details change. A newer
    // request supersedes an older one.
    useEffect(() => {
        if (loading) return;
        let current = true;
        const timer = setTimeout(async () => {
            const result = await PreviewReceiptEmail(subject, body, territoryId);
            if (current && result) setPreview(result);
        }, PREVIEW_DELAY_MS);
        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [subject, body, loading, territoryId, general.companyName, general.customerServicePhone]);

    const maxBody = saved?.maxLength ?? 5000;
    const maxSubject = saved?.maxSubjectLength ?? 150;

    /**
     * Puts a placeholder in place of the selection in a field.
     * @param field The field.
     * @param name The placeholder's name.
     * @param at Where the cursor or selection is in it.
     * @returns Where the cursor goes after it, or null when the field is already full.
     */
    const insert = (
        field: ReceiptEmailField,
        name: string,
        at: { start: number; end: number }
    ): number | null => {
        const inSubject = field === "subject";
        const done = InsertPlaceholder(
            inSubject ? subject : body,
            at,
            name,
            inSubject ? maxSubject : maxBody
        );
        if (!done) {
            Toast.Warning(`The ${inSubject ? "subject" : "email"} is as long as it can be.`);
            return null;
        }
        if (inSubject) setSubject(done.text);
        else setBody(done.text);
        return done.caret;
    };

    const save = async (nextSubject: string, nextBody: string) => {
        setSaving(true);
        const result = await SaveReceiptEmailSettings(nextSubject, nextBody, territoryId);
        setSaving(false);
        if (!result) return false;
        setSaved(result);
        setSubject(result.subject ?? "");
        setBody(result.body ?? "");
        return true;
    };

    // An empty email can't be sent, so saving one asks to go back to the default wording.
    const handleSave = async () => {
        if (!body.trim()) return setResetting(true);
        if (await save(subject, body)) Toast.Success("Receipt email saved.");
    };

    const handleReset = async () => {
        setResetting(false);
        if (await save("", "")) Toast.Success("Receipt email is back to the default wording.");
    };

    return {
        loading,
        saved,
        subject,
        setSubject,
        body,
        setBody,
        maxSubject,
        maxBody,
        dirty: subject !== (saved?.subject ?? "") || body !== (saved?.body ?? ""),
        /** The wording as saved, put back. */
        discard: () => {
            setSubject(saved?.subject ?? "");
            setBody(saved?.body ?? "");
        },
        preview,
        /** Placeholders the wording uses that the email doesn't know. */
        unknown: preview?.unknownPlaceholders ?? [],
        insert,
        saving,
        handleSave,
        resetting,
        setResetting,
        handleReset,
    };
};
