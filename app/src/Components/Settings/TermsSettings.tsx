import { useEffect, useState } from "react";
import { Text as RNText, TextInput, View } from "react-native";
import SettingsCard from "./SettingsCard";
import { SERIF } from "../Checkout/SheetTable";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Grid from "../Elements/Grid";
import Icon from "../Elements/Icon";
import SelectField from "../Elements/SelectField";
import { RenderTermText } from "../Elements/TermText";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { useSettings } from "../../Context/SettingsContext";
import { Toast } from "../../Lib/Toast";
import { AskWhenOptions, DefaultSalesTerms } from "../../Models/GeneralSettings";
import type { AskWhen, SalesTerm } from "../../Models/GeneralSettings";
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
            t.text.trim() === b[i].text &&
            (t.askWhen ?? "always") === (b[i].askWhen ?? "always")
    );

type Props = {
    onLayout?: (id: string, y: number) => void;
};

/**
 * The four statements a customer initials. Each paragraph is printed on the sales sheet beside
 * its INITIAL line and shown, word for word, on the customer's initialling screen.
 */
const TermsSettings = ({ onLayout }: Props) => {
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
            description="The statements customers initial."
            status={isDefault ? "Using the paper form's wording." : "Using your own wording."}
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onDiscard={() => setTerms(settings.terms)}
            onReset={isDefault ? undefined : () => setResetting(true)}
            onLayout={onLayout}
        >
            <View className="mb-3 flex-row items-start gap-2 rounded-lg bg-sky-50 p-3 dark:bg-sky-950/40">
                <Icon icon="fa-solid fa-circle-info" className="mt-0.5 text-sm text-sky-900 dark:text-sky-100" />
                <Text className="flex-1 text-sm text-sky-900 dark:text-sky-100">
                    <Text className="font-mono text-sm text-sky-900 dark:text-sky-100">**two stars**</Text> for{" "}
                    <Text className="text-sm font-bold text-sky-900 dark:text-sky-100">bold</Text>,{" "}
                    <Text className="font-mono text-sm text-sky-900 dark:text-sky-100">__two underscores__</Text>{" "}
                    to <Text className="text-sm text-sky-900 underline dark:text-sky-100">underline</Text>.
                </Text>
            </View>

            <View className="gap-4">
                {terms.map((t, index) => {
                    const fallback = defaults.find((d) => d.key === t.key);
                    return (
                        <View
                            key={t.key}
                            className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
                        >
                            <Text className="mb-2 text-sm font-semibold">
                                {index + 1}. {t.title || fallback?.title}
                            </Text>
                            <Grid columns={{ base: 1, md: 3 }}>
                                <TextField
                                    label="Title on the customer's screen"
                                    value={t.title}
                                    onChange={(v) => change(t.key, "title", v)}
                                    maxLength={MAX_HEADING}
                                    placeholder={fallback?.title}
                                />
                                <View>
                                    <TextField
                                        label="Heading on the sales sheet"
                                        value={t.heading}
                                        onChange={(v) => change(t.key, "heading", v)}
                                        maxLength={MAX_HEADING}
                                        placeholder="None"
                                    />
                                </View>
                                {/* A statement that doesn't apply to an order is skipped and prints N/A. */}
                                <SelectField<AskWhen>
                                    label="Ask the customer"
                                    value={t.askWhen ?? "always"}
                                    options={AskWhenOptions}
                                    onChange={(v) => change(t.key, "askWhen", v)}
                                />
                            </Grid>

                            <View className="mt-3 gap-1">
                                <View className="flex-row items-baseline justify-between gap-2">
                                    <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                        Paragraph
                                    </Text>
                                    <Text className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                                        {t.text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}
                                    </Text>
                                </View>
                                <TextInput
                                    value={t.text}
                                    onChangeText={(v) => change(t.key, "text", v)}
                                    maxLength={MAX_TEXT}
                                    multiline
                                    textAlignVertical="top"
                                    accessibilityLabel={`${t.title || fallback?.title} paragraph`}
                                    className="min-h-[96px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base leading-relaxed
                                        text-zinc-900 focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-sky-500"
                                />
                            </View>

                            <View className="mt-2">
                                <Text className={`mb-1 ${hint} font-semibold uppercase tracking-wide`}>
                                    As printed on the sales sheet
                                </Text>
                                {/* Paper colours whatever the theme, in the sheet's serif. */}
                                <View className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700">
                                    <RNText
                                        style={{ fontFamily: SERIF, fontSize: 13, lineHeight: 17, color: "#000" }}
                                    >
                                        {t.heading.trim() ? (
                                            <RNText style={{ fontWeight: "700", textDecorationLine: "underline" }}>
                                                {t.heading.trim()}:
                                            </RNText>
                                        ) : null}
                                        {t.heading.trim() ? " " : ""}
                                        {RenderTermText(t.text)}{" "}
                                        <RNText style={{ fontWeight: "700" }}>
                                            INITIAL{" "}
                                            <RNText style={{ textDecorationLine: "underline" }}>
                                                {"      "}
                                            </RNText>
                                        </RNText>
                                    </RNText>
                                </View>
                            </View>
                        </View>
                    );
                })}
            </View>

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
