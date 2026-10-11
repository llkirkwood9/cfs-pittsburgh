import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import SettingsCard from "./SettingsCard";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Grid from "../Elements/Grid";
import HtmlPreview from "../Elements/HtmlPreview";
import Icon from "../Elements/Icon";
import ListSkeleton from "../Elements/ListSkeleton";
import Text from "../Elements/Text";
import { useSettings } from "../../Context/SettingsContext";
import { useTheme } from "../../Hooks/UseTheme";
import { cx } from "../../Lib/ClassNames";
import { FormatDateTime } from "../../Lib/ModelHelpers";
import { Toast } from "../../Lib/Toast";
import type {
    ReceiptEmailPreview,
    ReceiptEmailSettings as ReceiptEmail,
} from "../../Models/ReceiptEmailSettings";
import {
    GetReceiptEmailSettings,
    PreviewReceiptEmail,
    SaveReceiptEmailSettings,
} from "../../Services/SettingsServices";

/** How long typing has to pause before the preview refreshes. */
const PREVIEW_DELAY_MS = 400;

const label = "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
const field =
    "w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-sky-500";

type Selection = { start: number; end: number };

type Props = {
    onLayout?: (id: string, y: number) => void;
};

/**
 * The subject and wording of the email that goes with a customer's emailed receipt, with a live
 * preview for a sample order.
 */
const ReceiptEmailSettings = ({ onLayout }: Props) => {
    const { settings: general } = useSettings();
    const { isDark } = useTheme();
    const [saved, setSaved] = useState<ReceiptEmail | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [subject, setSubject] = useState<string>("");
    const [body, setBody] = useState<string>("");
    const [preview, setPreview] = useState<ReceiptEmailPreview | null>(null);
    const [saving, setSaving] = useState<boolean>(false);
    const [resetting, setResetting] = useState<boolean>(false);
    const [showHelp, setShowHelp] = useState<boolean>(false);
    // Where a tapped placeholder goes: the field used last, at its cursor.
    const target = useRef<"subject" | "body">("body");
    const selections = useRef<Record<"subject" | "body", Selection | null>>({
        subject: null,
        body: null,
    });

    useEffect(() => {
        const load = async () => {
            const found = await GetReceiptEmailSettings();
            setSaved(found);
            setSubject(found?.subject ?? "");
            setBody(found?.body ?? "");
            setLoading(false);
        };
        load();
    }, []);

    // Refresh the preview once typing pauses, or when the business details change. A newer
    // request supersedes an older one.
    useEffect(() => {
        if (loading) return;
        let current = true;
        const timer = setTimeout(async () => {
            const result = await PreviewReceiptEmail(subject, body);
            if (current && result) setPreview(result);
        }, PREVIEW_DELAY_MS);
        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [subject, body, loading, general.companyName, general.customerServicePhone]);

    if (loading) {
        return (
            <View className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                <ListSkeleton rows={3} />
            </View>
        );
    }

    if (!saved) {
        return (
            <View className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                <Text className="text-sm">The receipt email settings couldn&apos;t be loaded.</Text>
            </View>
        );
    }

    const maxBody = saved.maxLength ?? 5000;
    const maxSubject = saved.maxSubjectLength ?? 150;
    const dirty = subject !== (saved.subject ?? "") || body !== (saved.body ?? "");
    const unknown = preview?.unknownPlaceholders ?? [];

    // Puts a placeholder where the cursor is in the field used last.
    const insert = (name: string) => {
        const token = `{${name}}`;
        const inSubject = target.current === "subject";
        const value = inSubject ? subject : body;
        const at = selections.current[target.current] ?? { start: value.length, end: value.length };
        const next = value.slice(0, at.start) + token + value.slice(at.end);
        if (next.length > (inSubject ? maxSubject : maxBody))
            return Toast.Warning(`The ${inSubject ? "subject" : "email"} is as long as it can be.`);
        if (inSubject) setSubject(next);
        else setBody(next);
        const after = at.start + token.length;
        selections.current[target.current] = { start: after, end: after };
    };

    const save = async (nextSubject: string, nextBody: string) => {
        setSaving(true);
        const result = await SaveReceiptEmailSettings(nextSubject, nextBody);
        setSaving(false);
        if (!result) return false;
        setSaved(result);
        setSubject(result.subject ?? "");
        setBody(result.body ?? "");
        return true;
    };

    const handleSave = async () => {
        if (!body.trim()) return setResetting(true);
        if (await save(subject, body)) Toast.Success("Receipt email saved.");
    };

    const handleReset = async () => {
        setResetting(false);
        if (await save("", "")) Toast.Success("Receipt email is back to the default wording.");
    };

    const placeholderColor = isDark ? "#71717a" : "#a1a1aa";

    return (
        <SettingsCard
            id="receipt-email"
            title="Receipt email"
            icon="fa-solid fa-envelope"
            description="The message customers get when their receipt is emailed. The receipt itself is attached as a PDF."
            badge={
                <View
                    className={cx(
                        "flex-row items-center gap-1.5 rounded-full px-2.5 py-1",
                        saved.isDefault ? "bg-zinc-100 dark:bg-zinc-700" : "bg-sky-100 dark:bg-sky-950/60"
                    )}
                >
                    <Icon
                        icon={saved.isDefault ? "fa-solid fa-file-lines" : "fa-solid fa-pen"}
                        className={cx(
                            "text-xs",
                            saved.isDefault ? "text-zinc-700 dark:text-zinc-200" : "text-sky-800 dark:text-sky-200"
                        )}
                    />
                    <Text
                        className={cx(
                            "text-xs font-semibold",
                            saved.isDefault ? "text-zinc-700 dark:text-zinc-200" : "text-sky-800 dark:text-sky-200"
                        )}
                    >
                        {saved.isDefault ? "Default wording" : "Custom wording"}
                    </Text>
                </View>
            }
            status={
                saved.isDefault
                    ? "Using the default wording."
                    : `Last changed${saved.updatedBy ? ` by ${saved.updatedBy}` : ""}${
                          saved.updatedAt ? ` on ${FormatDateTime(saved.updatedAt)}` : ""
                      }.`
            }
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onDiscard={() => {
                setSubject(saved.subject ?? "");
                setBody(saved.body ?? "");
            }}
            onReset={saved.isDefault ? undefined : () => setResetting(true)}
            onLayout={onLayout}
        >
            <Grid columns={{ base: 1, lg: 2 }} gap={16}>
                {/* Editor */}
                <View>
                    <View className="gap-1">
                        <Text className={label}>Subject</Text>
                        <TextInput
                            value={subject}
                            onChangeText={setSubject}
                            onFocus={() => (target.current = "subject")}
                            onSelectionChange={(e) => (selections.current.subject = e.nativeEvent.selection)}
                            maxLength={maxSubject}
                            accessibilityLabel="Subject"
                            placeholderTextColor={placeholderColor}
                            className={cx(field, "min-h-[48px]")}
                        />
                    </View>

                    <View className="mt-3 gap-1">
                        <View className="flex-row items-baseline justify-between gap-2">
                            <Text className={label}>Message</Text>
                            <Text className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                                {body.length.toLocaleString()} / {maxBody.toLocaleString()}
                            </Text>
                        </View>
                        <TextInput
                            value={body}
                            onChangeText={setBody}
                            onFocus={() => (target.current = "body")}
                            onSelectionChange={(e) => (selections.current.body = e.nativeEvent.selection)}
                            maxLength={maxBody}
                            multiline
                            numberOfLines={14}
                            textAlignVertical="top"
                            spellCheck
                            accessibilityLabel="Message"
                            className={cx(field, "min-h-[300px] py-2 leading-relaxed")}
                        />
                    </View>

                    {unknown.length > 0 && (
                        <View className="mt-2 flex-row items-start gap-2">
                            <Icon
                                icon="fa-solid fa-triangle-exclamation"
                                className="mt-0.5 text-sm text-amber-700 dark:text-amber-400"
                            />
                            <Text className="flex-1 text-sm text-amber-700 dark:text-amber-400">
                                {unknown.map((u) => `{${u}}`).join(", ")}{" "}
                                {unknown.length === 1 ? "isn't a placeholder" : "aren't placeholders"}{" "}
                                the app knows, so {unknown.length === 1 ? "it" : "they"} will be sent
                                exactly as typed. Check the spelling against the list below.
                            </Text>
                        </View>
                    )}

                    <View className="mt-3">
                        <Text className={cx(label, "mb-1.5")}>Insert a placeholder</Text>
                        <View className="flex-row flex-wrap gap-1.5">
                            {(saved.placeholders ?? []).map((p) => (
                                <Pressable
                                    key={p.name}
                                    onPress={() => insert(p.name ?? "")}
                                    accessibilityRole="button"
                                    accessibilityHint={p.description ?? undefined}
                                    className="min-h-[36px] justify-center rounded-lg border border-zinc-300 bg-zinc-50 px-2.5
                                        active:bg-sky-50 dark:border-zinc-600 dark:bg-zinc-900/40 dark:active:bg-sky-950/40"
                                >
                                    <Text className="font-mono text-xs text-zinc-800 dark:text-zinc-200">
                                        {`{${p.name}}`}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    <View className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/40">
                        <Pressable
                            onPress={() => setShowHelp((open) => !open)}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: showHelp }}
                            className="min-h-[32px] flex-row items-center gap-2"
                        >
                            <Icon
                                icon={showHelp ? "fa-solid fa-caret-down" : "fa-solid fa-caret-right"}
                                className="text-sm text-zinc-500"
                            />
                            <Text className="text-sm font-semibold">How the message is laid out</Text>
                        </Pressable>
                        {showHelp && (
                            <View className="mt-2 gap-1">
                                {[
                                    "Leave a blank line between paragraphs.",
                                    'Start lines with "- " to make a bulleted list.',
                                    "Placeholders in curly braces are filled in for each order, in the subject as well as the message. Tap one above to add it where the cursor is.",
                                    'Put {WhatHappensNext} on a line of its own for the "What happens next" list. It only lists what applies to that order, and disappears when nothing does.',
                                    "The company name and phone number come from Business details above.",
                                ].map((line) => (
                                    <Text key={line} className="text-sm text-zinc-700 dark:text-zinc-300">
                                        • {line}
                                    </Text>
                                ))}
                                <View className="mt-2 gap-1.5">
                                    {(saved.placeholders ?? []).map((p) => (
                                        <Text key={p.name} className="text-sm text-zinc-600 dark:text-zinc-400">
                                            <Text className="font-mono text-xs font-semibold">{`{${p.name}}`}</Text>{" "}
                                            {p.description}
                                        </Text>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                {/* Preview */}
                <View>
                    <Text className={cx(label, "mb-1")}>Preview for a sample order</Text>
                    <View className="overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-600">
                        <View className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/40">
                            <Text className="text-sm">
                                <Text className="text-sm text-zinc-500 dark:text-zinc-400">From: </Text>
                                {general.appName}
                            </Text>
                            <Text className="text-sm">
                                <Text className="text-sm text-zinc-500 dark:text-zinc-400">Subject: </Text>
                                <Text className="text-sm font-semibold">{preview?.subject}</Text>
                            </Text>
                            <View className="mt-0.5 flex-row items-center gap-1.5">
                                <Icon icon="fa-solid fa-paperclip" className="text-xs text-zinc-500 dark:text-zinc-400" />
                                <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {preview?.attachmentName ?? "CFS-Receipt.pdf"}
                                </Text>
                            </View>
                        </View>
                        <HtmlPreview html={preview?.html ?? ""} height={520} title="Receipt email preview" />
                    </View>
                </View>
            </Grid>

            {resetting && (
                <ConfirmationModal
                    title="Go back to the default wording"
                    message="Replace the receipt email's subject and message with the default wording? Your current wording will be lost."
                    confirmText="Use the default"
                    onConfirm={handleReset}
                    onCancel={() => setResetting(false)}
                />
            )}
        </SettingsCard>
    );
};

export default ReceiptEmailSettings;
