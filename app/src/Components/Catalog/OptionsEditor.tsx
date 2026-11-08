import { TextInput, View } from "react-native";
import Button from "../Elements/Button";
import Checkbox from "../Elements/Checkbox";
import IconButton from "../Elements/IconButton";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { cx } from "../../Lib/ClassNames";
import { OptionEdits } from "@shared/Lib/CatalogDrafts";
import type { DraftChoice, DraftOption } from "@shared/Lib/CatalogDrafts";

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
        onChange(OptionEdits.set(options, key, changes));

    const setChoice = (optionKey: string, choiceKey: string, changes: Partial<DraftChoice>) =>
        onChange(OptionEdits.setChoice(options, optionKey, choiceKey, changes));

    return (
        <View>
            <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Selections
                </Text>
                <Button
                    text="Add selection"
                    icon="fa-solid fa-plus"
                    onClick={() => onChange(OptionEdits.add(options))}
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
                                    onPress={() => onChange(OptionEdits.move(options, index, -1))}
                                    disabled={index === 0}
                                    className="h-12 w-10"
                                />
                                <IconButton
                                    icon="fa-solid fa-arrow-down"
                                    label={`Move ${option.name || "selection"} down`}
                                    onPress={() => onChange(OptionEdits.move(options, index, 1))}
                                    disabled={index === options.length - 1}
                                    className="h-12 w-10"
                                />
                                <IconButton
                                    icon="fa-solid fa-trash"
                                    label={`Remove ${option.name || "selection"}`}
                                    onPress={() =>
                                        onChange(OptionEdits.remove(options, option.key))
                                    }
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
                                onChange={(checked) =>
                                    setOption(option.key, { isRequired: checked })
                                }
                                className="bg-white dark:bg-zinc-800"
                            />
                            {trackInventory && (
                                <Checkbox
                                    label="Count stock for each choice"
                                    checked={option.tracksStock}
                                    onChange={(checked) =>
                                        setOption(option.key, { tracksStock: checked })
                                    }
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
                                            onChange(
                                                OptionEdits.removeChoice(
                                                    options,
                                                    option.key,
                                                    choice.key
                                                )
                                            )
                                        }
                                        danger
                                        className="h-10 w-10"
                                    />
                                </View>
                            ))}
                            <Button
                                text="Add choice"
                                icon="fa-solid fa-plus"
                                onClick={() => onChange(OptionEdits.addChoice(options, option.key))}
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
