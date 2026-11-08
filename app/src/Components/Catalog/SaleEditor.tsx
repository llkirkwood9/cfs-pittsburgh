import { Pressable, TextInput, View } from "react-native";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
import { PickSaleMode, SaleModes, SaleModeText } from "@shared/Lib/CatalogDrafts";
import type { SaleDraft } from "@shared/Lib/CatalogDrafts";

type Props = {
    draft: SaleDraft;
    onChange: (draft: SaleDraft) => void;
    /** For a size: offer "Same as the item". */
    allowFollow?: boolean;
    /** What the size would follow, for its label, e.g. "20% off". */
    followLabel?: string;
    /** The follow button's name, e.g. "Same as option" for a delivery choice. */
    followName?: string;
    label?: string;
};

/**
 * Picks a sale: none, a percent off, or a fixed amount off each item. For a single size it can
 * also follow the product's sale, which it does unless told otherwise.
 */
const SaleEditor = ({
    draft,
    onChange,
    allowFollow = false,
    followLabel,
    followName = "Same as item",
    label = "Sale",
}: Props) => {
    const shown = SaleModes.filter((m) => allowFollow || m.mode !== "follow");

    return (
        <View className="gap-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
            </Text>
            <View className="flex-row flex-wrap items-center gap-2">
                <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel={label}
                    className="flex-row flex-wrap overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-600"
                >
                    {shown.map((m, index) => {
                        const selected = draft.mode === m.mode;
                        return (
                            <Pressable
                                key={m.mode}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: selected }}
                                onPress={() => onChange(PickSaleMode(draft, m.mode))}
                                className={cx(
                                    "min-h-[40px] justify-center px-3",
                                    index > 0 && "border-l border-zinc-300 dark:border-zinc-600",
                                    selected
                                        ? "bg-sky-700 dark:bg-sky-600"
                                        : "bg-white active:bg-zinc-100 dark:bg-zinc-800 dark:active:bg-zinc-700"
                                )}
                            >
                                <Text
                                    className={cx(
                                        "text-sm font-semibold",
                                        selected ? "text-white" : "text-zinc-700 dark:text-zinc-200"
                                    )}
                                >
                                    {SaleModeText(m.mode, followName, followLabel)}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
                {(draft.mode === "percent" || draft.mode === "amount") && (
                    <View className="flex-row items-center gap-1">
                        {draft.mode === "amount" && (
                            <Text className="text-sm font-semibold">$</Text>
                        )}
                        <TextInput
                            value={draft.text}
                            onChangeText={(text) => onChange({ ...draft, text })}
                            keyboardType="decimal-pad"
                            inputMode="decimal"
                            accessibilityLabel={
                                draft.mode === "percent"
                                    ? `${label} percent off`
                                    : `${label} amount off`
                            }
                            placeholder={draft.mode === "percent" ? "20" : "300"}
                            placeholderTextColor="#a1a1aa"
                            className="min-h-[40px] w-24 rounded-lg border border-zinc-300 bg-white px-2 text-base text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        {draft.mode === "percent" && (
                            <Text className="text-sm font-semibold">%</Text>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
};

export default SaleEditor;
