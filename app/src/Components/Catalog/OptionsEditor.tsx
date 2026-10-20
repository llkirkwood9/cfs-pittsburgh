import { TextInput, View } from "react-native";
import Button from "../Elements/Button";
import Checkbox from "../Elements/Checkbox";
import IconButton from "../Elements/IconButton";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { cx } from "../../Lib/ClassNames";
import { ParseMoney } from "../../Lib/ModelHelpers";
import type { ProductOption } from "../../Models/ProductOption";

/** A choice being edited. `key` is local, so new rows have something stable to key on. */
export type DraftChoice = { key: string; id?: number; name: string; priceText: string };

/** A selection being edited. */
export type DraftOption = {
    key: string;
    id?: number;
    name: string;
    isRequired: boolean;
    tracksStock: boolean;
    choices: DraftChoice[];
};

let counter = 0;
const nextKey = () => `new-${++counter}`;

/** A product's selections as the editor shows them. */
export const ToDraftOptions = (options?: ProductOption[]): DraftOption[] =>
    (options ?? []).map((o) => ({
        key: `o-${o.id}`,
        id: o.id,
        name: o.name ?? "",
        isRequired: o.isRequired ?? true,
        tracksStock: o.tracksStock ?? false,
        choices: (o.choices ?? []).map((c) => ({
            key: `c-${c.id}`,
            id: c.id,
            name: c.name ?? "",
            priceText:
                c.priceAdjustment === null || c.priceAdjustment === undefined
                    ? ""
                    : String(c.priceAdjustment),
        })),
    }));

/** The editor's selections as saved. Blank choices are dropped. */
export const FromDraftOptions = (options: DraftOption[]): ProductOption[] =>
    options.map((o, index) => ({
        id: o.id,
        name: o.name.trim(),
        sortOrder: index + 1,
        isRequired: o.tracksStock || o.isRequired,
        tracksStock: o.tracksStock,
        choices: o.choices
            .filter((c) => c.name.trim())
            .map((c, i) => ({
                id: c.id,
                name: c.name.trim(),
                priceAdjustment: c.priceText.trim() === "" ? null : ParseMoney(c.priceText),
                sortOrder: i + 1,
                isActive: true,
            })),
    }));

/**
 * Why the selections can't be saved, or null when they're fine.
 * @param options The selections.
 * @returns A message, or null.
 */
export const OptionsProblem = (options: DraftOption[]): string | null => {
    for (const o of options) {
        if (!o.name.trim()) return "Every selection needs a name, such as Color.";
        const named = o.choices.filter((c) => c.name.trim());
        if (named.length === 0) return `Give "${o.name}" at least one choice.`;
        if (new Set(named.map((c) => c.name.trim().toLowerCase())).size !== named.length)
            return `"${o.name}" lists the same choice twice.`;
        if (named.some((c) => c.priceText.trim() !== "" && ParseMoney(c.priceText) === null))
            return `Check the price changes for "${o.name}" - they must be numbers.`;
    }
    const names = options.map((o) => o.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return "Two selections have the same name.";
    return null;
};

type Props = {
    options: DraftOption[];
    onChange: (options: DraftOption[]) => void;
    /** Whether the product tracks inventory, so stock can be counted per choice. */
    trackInventory: boolean;
};

const chip =
    "min-h-[40px] rounded-lg border border-zinc-300 bg-white px-2 text-base text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";

/**
 * A product's selections beyond size - Color for sheets, say, or anything else - each with its
 * own list of choices. A choice can change the price, and a selection can count stock for each
 * choice when the product tracks inventory.
 */
const OptionsEditor = ({ options, onChange, trackInventory }: Props) => {
    const setOption = (key: string, changes: Partial<DraftOption>) =>
        onChange(options.map((o) => (o.key === key ? { ...o, ...changes } : o)));

    const setChoice = (optionKey: string, choiceKey: string, changes: Partial<DraftChoice>) =>
        onChange(
            options.map((o) =>
                o.key === optionKey
                    ? {
                          ...o,
                          choices: o.choices.map((c) =>
                              c.key === choiceKey ? { ...c, ...changes } : c
                          ),
                      }
                    : o
            )
        );

    const move = (index: number, by: number) => {
        const target = index + by;
        if (target < 0 || target >= options.length) return;
        const next = [...options];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const add = () =>
        onChange([
            ...options,
            {
                key: nextKey(),
                name: "",
                isRequired: true,
                tracksStock: false,
                choices: [{ key: nextKey(), name: "", priceText: "" }],
            },
        ]);

    return (
        <View>
            <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Selections
                </Text>
                <Button
                    text="Add selection"
                    icon="fa-solid fa-plus"
                    onClick={add}
                    className="min-h-[40px] px-3 text-sm"
                />
            </View>

            {options.length === 0 && (
                <View className="rounded-xl border-2 border-dashed border-zinc-300 py-4 dark:border-zinc-600">
                    <Text className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No selections - the rep only picks a size.
                    </Text>
                </View>
            )}

            <View className="gap-3">
                {options.map((option, index) => (
                    <View key={option.key} className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-700">
                        <View className="flex-row flex-wrap items-end gap-2">
                            <TextField
                                label="Selection"
                                value={option.name}
                                onChange={(value) => setOption(option.key, { name: value })}
                                placeholder="Color"
                                maxLength={50}
                                autoCapitalize="words"
                                className="min-w-[160px] flex-1"
                            />
                            <View className="flex-row gap-1">
                                <IconButton
                                    icon="fa-solid fa-arrow-up"
                                    label={`Move ${option.name || "selection"} up`}
                                    onPress={() => move(index, -1)}
                                    disabled={index === 0}
                                    className="h-12 w-10"
                                />
                                <IconButton
                                    icon="fa-solid fa-arrow-down"
                                    label={`Move ${option.name || "selection"} down`}
                                    onPress={() => move(index, 1)}
                                    disabled={index === options.length - 1}
                                    className="h-12 w-10"
                                />
                                <IconButton
                                    icon="fa-solid fa-trash"
                                    label={`Remove ${option.name || "selection"}`}
                                    onPress={() => onChange(options.filter((o) => o.key !== option.key))}
                                    danger
                                    className="h-12 w-10"
                                />
                            </View>
                        </View>

                        <View className="mt-2 gap-2">
                            <Checkbox
                                label="Must be picked"
                                checked={option.tracksStock || option.isRequired}
                                disabled={option.tracksStock}
                                onChange={(checked) => setOption(option.key, { isRequired: checked })}
                                className="bg-white dark:bg-zinc-800"
                            />
                            {trackInventory && (
                                <Checkbox
                                    label="Count stock for each choice"
                                    checked={option.tracksStock}
                                    onChange={(checked) => setOption(option.key, { tracksStock: checked })}
                                    className="bg-white dark:bg-zinc-800"
                                />
                            )}
                        </View>
                        {option.tracksStock && option.id ? (
                            <Text className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                Turning this off, or removing the selection, clears the counts kept
                                for each choice.
                            </Text>
                        ) : null}

                        <View className="mt-2 gap-2">
                            {option.choices.map((choice) => (
                                <View key={choice.key} className="flex-row items-center gap-2">
                                    <TextInput
                                        value={choice.name}
                                        onChangeText={(value) =>
                                            setChoice(option.key, choice.key, { name: value })
                                        }
                                        maxLength={50}
                                        placeholder="Choice, ex. Gray"
                                        placeholderTextColor="#a1a1aa"
                                        accessibilityLabel={`${option.name || "Selection"} choice`}
                                        className={cx(chip, "flex-1")}
                                    />
                                    <TextInput
                                        value={choice.priceText}
                                        onChangeText={(value) =>
                                            setChoice(option.key, choice.key, { priceText: value })
                                        }
                                        keyboardType="numbers-and-punctuation"
                                        inputMode="decimal"
                                        placeholder="+$0"
                                        placeholderTextColor="#a1a1aa"
                                        accessibilityLabel={`Price change for ${choice.name || "choice"}`}
                                        className={cx(chip, "w-28")}
                                    />
                                    <IconButton
                                        icon="fa-solid fa-xmark"
                                        label={`Remove ${choice.name || "choice"}`}
                                        onPress={() =>
                                            setOption(option.key, {
                                                choices: option.choices.filter((c) => c.key !== choice.key),
                                            })
                                        }
                                        danger
                                        className="h-10 w-10"
                                    />
                                </View>
                            ))}
                            <Button
                                text="Add choice"
                                icon="fa-solid fa-plus"
                                onClick={() =>
                                    setOption(option.key, {
                                        choices: [
                                            ...option.choices,
                                            { key: nextKey(), name: "", priceText: "" },
                                        ],
                                    })
                                }
                                className="min-h-[36px] self-start bg-zinc-500 px-3 text-sm dark:bg-zinc-600"
                            />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

export default OptionsEditor;
