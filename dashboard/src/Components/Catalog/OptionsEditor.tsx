import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import TextField from "../Elements/TextField";
import { OptionEdits } from "@shared/Lib/CatalogDrafts";
import type { DraftChoice, DraftOption } from "@shared/Lib/CatalogDrafts";
import { Limits } from "@shared/Lib/Limits";

type Props = {
    options: DraftOption[];
    onChange: (options: DraftOption[]) => void;
    /** Whether the product tracks inventory, so stock can be counted per choice. */
    trackInventory: boolean;
};

const chip =
    "min-h-[40px] w-full rounded-lg border border-zinc-300 bg-white px-2 text-base dark:border-zinc-600 dark:bg-zinc-800";

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
        <section>
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Selections
                </h3>
                <Button
                    text="Add selection"
                    icon="fa-solid fa-plus"
                    onClick={() => onChange(OptionEdits.add(options))}
                    className="min-h-[40px] px-3 text-sm"
                />
            </div>

            {options.length === 0 && (
                <p className="rounded-xl border-2 border-dashed border-zinc-300 py-4 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
                    No selections - the rep only picks a size.
                </p>
            )}

            <ul className="space-y-3">
                {options.map((option, index) => (
                    <li key={option.key} className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-700">
                        <div className="flex flex-wrap items-end gap-2">
                            <TextField
                                label="Selection"
                                value={option.name}
                                onChange={(value) => setOption(option.key, { name: value })}
                                placeholder="Color"
                                maxLength={Limits.optionName}
                                className="min-w-40 flex-1"
                            />
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => onChange(OptionEdits.move(options, index, -1))}
                                    disabled={index === 0}
                                    aria-label={`Move ${option.name || "selection"} up`}
                                    className="flex h-12 w-10 items-center justify-center rounded-xl hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-600"
                                >
                                    <Icon icon="fa-solid fa-arrow-up" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onChange(OptionEdits.move(options, index, 1))}
                                    disabled={index === options.length - 1}
                                    aria-label={`Move ${option.name || "selection"} down`}
                                    className="flex h-12 w-10 items-center justify-center rounded-xl hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-600"
                                >
                                    <Icon icon="fa-solid fa-arrow-down" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onChange(OptionEdits.remove(options, option.key))
                                    }
                                    aria-label={`Remove ${option.name || "selection"}`}
                                    className="flex h-12 w-10 items-center justify-center rounded-xl text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                    <Icon icon="fa-solid fa-trash" />
                                </button>
                            </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                            <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={option.tracksStock || option.isRequired}
                                    disabled={option.tracksStock}
                                    onChange={(e) =>
                                        setOption(option.key, { isRequired: e.target.checked })
                                    }
                                    className="h-5 w-5 accent-sky-600"
                                />
                                Must be picked
                            </label>
                            {trackInventory && (
                                <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={option.tracksStock}
                                        onChange={(e) =>
                                            setOption(option.key, { tracksStock: e.target.checked })
                                        }
                                        className="h-5 w-5 accent-sky-600"
                                    />
                                    Count stock for each choice
                                </label>
                            )}
                        </div>
                        {option.tracksStock && option.id && (
                            <p className="mb-1 text-xs text-amber-700 dark:text-amber-400">
                                Turning this off, or removing the selection, clears the counts kept
                                for each choice.
                            </p>
                        )}

                        <div className="mt-2 space-y-2">
                            {option.choices.map((choice) => (
                                <div
                                    key={choice.key}
                                    className="grid grid-cols-[1fr_7rem_auto] items-center gap-2"
                                >
                                    <input
                                        value={choice.name}
                                        onChange={(e) =>
                                            setChoice(option.key, choice.key, {
                                                name: e.target.value,
                                            })
                                        }
                                        maxLength={Limits.optionName}
                                        placeholder="Choice, ex. Gray"
                                        aria-label={`${option.name || "Selection"} choice`}
                                        className={chip}
                                    />
                                    <input
                                        value={choice.priceText}
                                        onChange={(e) =>
                                            setChoice(option.key, choice.key, {
                                                priceText: e.target.value,
                                            })
                                        }
                                        inputMode="decimal"
                                        placeholder="+$0"
                                        aria-label={`Price change for ${choice.name || "choice"}`}
                                        className={chip}
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChange(
                                                OptionEdits.removeChoice(
                                                    options,
                                                    option.key,
                                                    choice.key
                                                )
                                            )
                                        }
                                        aria-label={`Remove ${choice.name || "choice"}`}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                                    >
                                        <Icon icon="fa-solid fa-xmark" />
                                    </button>
                                </div>
                            ))}
                            <Button
                                text="Add choice"
                                icon="fa-solid fa-plus"
                                onClick={() => onChange(OptionEdits.addChoice(options, option.key))}
                                className="min-h-[36px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                            />
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default OptionsEditor;
