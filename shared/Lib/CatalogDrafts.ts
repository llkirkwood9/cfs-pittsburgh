import { ParseMoney } from "./Format";
import { DiscountText, HasDiscount } from "./Pricing";
import type { Discount } from "./Pricing";
import type { ProductOption } from "../Models/ProductOption";

/** How a sale is set: none, a percent off, a fixed amount off each item - or, for a size, the product's. */
export type SaleMode = "none" | "percent" | "amount" | "follow";

/** A sale being edited: its mode and the number typed. */
export type SaleDraft = { mode: SaleMode; text: string };

/** A sale that follows what it belongs to - the item's, or a delivery option's own. */
export const FollowSale: SaleDraft = { mode: "follow", text: "" };

/** The sale editor's buttons, in the order they are shown. */
export const SaleModes: { mode: SaleMode; label: string }[] = [
    { mode: "follow", label: "Same as item" },
    { mode: "none", label: "No sale" },
    { mode: "percent", label: "% off" },
    { mode: "amount", label: "$ off" },
];

/**
 * A sale as the editor shows it.
 * @param percent Percent off, if any.
 * @param amount Amount off, if any.
 * @param follow For a size: whether it follows the product's sale.
 * @returns The draft.
 */
export const ToSaleDraft = (
    percent?: number | null,
    amount?: number | null,
    follow = false
): SaleDraft =>
    follow
        ? FollowSale
        : (percent ?? 0) > 0
          ? { mode: "percent", text: String(percent) }
          : (amount ?? 0) > 0
            ? { mode: "amount", text: String(amount) }
            : { mode: "none", text: "" };

/**
 * A sale draft as saved: percent and amount (0 clears).
 * @param draft The draft.
 * @returns Percent and amount.
 */
export const FromSaleDraft = (draft: SaleDraft): { percent: number; amount: number } => {
    const value = ParseMoney(draft.text) ?? 0;
    return {
        percent: draft.mode === "percent" ? value : 0,
        amount: draft.mode === "amount" ? value : 0,
    };
};

/**
 * Why a sale draft can't be saved, or null when it's fine.
 * @param draft The draft.
 * @returns A message, or null.
 */
export const SaleProblem = (draft: SaleDraft): string | null => {
    if (draft.mode !== "percent" && draft.mode !== "amount") return null;
    const value = ParseMoney(draft.text);
    if (value === null || value <= 0) return "Enter how much the sale takes off.";
    if (draft.mode === "percent" && value > 100) return "A sale can take off at most 100%.";
    return null;
};

/**
 * The draft after a mode button is pressed: the number typed is kept only when the mode stays.
 * @param draft The current draft.
 * @param mode The mode pressed.
 * @returns The new draft.
 */
export const PickSaleMode = (draft: SaleDraft, mode: SaleMode): SaleDraft => ({
    mode,
    text: mode === draft.mode ? draft.text : "",
});

/**
 * A sale editor button's text. The follow button names what it follows, e.g.
 * "Same as item (20% off)".
 * @param mode The button's mode.
 * @param followName The follow button's name.
 * @param followLabel What it would follow, if known.
 * @returns The text.
 */
export const SaleModeText = (mode: SaleMode, followName: string, followLabel?: string): string =>
    mode === "follow"
        ? followLabel
            ? `${followName} (${followLabel})`
            : followName
        : (SaleModes.find((m) => m.mode === mode)?.label ?? "");

/**
 * What a sale takes off, for a follow button's label.
 * @param discount The sale.
 * @returns e.g. "20% off", or "no sale".
 */
export const SaleOffText = (discount: Discount): string =>
    HasDiscount(discount) ? `${DiscountText(discount)} off` : "no sale";

/**
 * What a sale draft takes off, for the label of the sizes that follow it.
 * @param draft The draft.
 * @returns e.g. "20% off", or "no sale" when there is none or it isn't valid yet.
 */
export const SaleDraftOffText = (draft: SaleDraft): string => {
    if (SaleProblem(draft) !== null || draft.mode === "none") return "no sale";
    const off = FromSaleDraft(draft);
    return SaleOffText({ percent: off.percent || null, amount: off.amount || null });
};

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

/**
 * Edits for the selections editor. Each takes the selections and returns the changed copy.
 */
export const OptionEdits = {
    /** Changes one selection. */
    set: (options: DraftOption[], key: string, changes: Partial<DraftOption>): DraftOption[] =>
        options.map((o) => (o.key === key ? { ...o, ...changes } : o)),

    /** Changes one choice of a selection. */
    setChoice: (
        options: DraftOption[],
        optionKey: string,
        choiceKey: string,
        changes: Partial<DraftChoice>
    ): DraftOption[] =>
        options.map((o) =>
            o.key === optionKey
                ? {
                      ...o,
                      choices: o.choices.map((c) =>
                          c.key === choiceKey ? { ...c, ...changes } : c
                      ),
                  }
                : o
        ),

    /** Moves a selection up (-1) or down (1); a move past either end changes nothing. */
    move: (options: DraftOption[], index: number, by: number): DraftOption[] => {
        const target = index + by;
        if (target < 0 || target >= options.length) return options;
        const next = [...options];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
    },

    /** Adds a blank selection with one blank choice. */
    add: (options: DraftOption[]): DraftOption[] => [
        ...options,
        {
            key: nextKey(),
            name: "",
            isRequired: true,
            tracksStock: false,
            choices: [{ key: nextKey(), name: "", priceText: "" }],
        },
    ],

    /** Removes a selection. */
    remove: (options: DraftOption[], key: string): DraftOption[] =>
        options.filter((o) => o.key !== key),

    /** Adds a blank choice to a selection. */
    addChoice: (options: DraftOption[], optionKey: string): DraftOption[] =>
        options.map((o) =>
            o.key === optionKey
                ? { ...o, choices: [...o.choices, { key: nextKey(), name: "", priceText: "" }] }
                : o
        ),

    /** Removes a choice from a selection. */
    removeChoice: (options: DraftOption[], optionKey: string, choiceKey: string): DraftOption[] =>
        options.map((o) =>
            o.key === optionKey
                ? { ...o, choices: o.choices.filter((c) => c.key !== choiceKey) }
                : o
        ),
};
