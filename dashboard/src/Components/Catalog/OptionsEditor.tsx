import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import TextField from "../Elements/TextField";
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
    "min-h-[40px] w-full rounded-lg border border-zinc-300 bg-white px-2 text-base dark:border-zinc-600 dark:bg-zinc-800";

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
        <section>
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Selections
                </h3>
                <Button
                    text="Add selection"
                    icon="fa-solid fa-plus"
                    onClick={add}
                    className="min-h-[40px] px-3 text-sm"
                />
            </div>
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                Anything the rep picks besides the size, such as a sheet set&apos;s Color. Each
                choice can add to the price (or take off, with a minus). The choice prints on the
                sales sheet with the item.
            </p>

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
                                maxLength={50}
                                className="min-w-40 flex-1"
                            />
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => move(index, -1)}
                                    disabled={index === 0}
                                    aria-label={`Move ${option.name || "selection"} up`}
                                    className="flex h-12 w-10 items-center justify-center rounded-xl hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-600"
                                >
                                    <Icon icon="fa-solid fa-arrow-up" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => move(index, 1)}
                                    disabled={index === options.length - 1}
                                    aria-label={`Move ${option.name || "selection"} down`}
                                    className="flex h-12 w-10 items-center justify-center rounded-xl hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-600"
                                >
                                    <Icon icon="fa-solid fa-arrow-down" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onChange(options.filter((o) => o.key !== option.key))
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
                                        maxLength={50}
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
                                            setOption(option.key, {
                                                choices: option.choices.filter(
                                                    (c) => c.key !== choice.key
                                                ),
                                            })
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
                                onClick={() =>
                                    setOption(option.key, {
                                        choices: [
                                            ...option.choices,
                                            { key: nextKey(), name: "", priceText: "" },
                                        ],
                                    })
                                }
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
