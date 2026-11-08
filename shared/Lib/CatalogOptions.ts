import { FromSaleDraft, SaleProblem, ToSaleDraft } from "./CatalogDrafts";
import type { SaleDraft } from "./CatalogDrafts";
import { ParseMoney } from "./Format";
import type { Category } from "../Models/Category";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { FinanceOption } from "../Models/FinanceOption";

/**
 * How one of the catalog's lists (delivery, financing, categories) is edited: what Add starts from,
 * the form it opens, what stops it saving, and what is saved.
 */
export type CatalogOptionForm<T, D> = {
    /** What Add opens. */
    blank: T;
    /** The option as the form shows it. */
    toDraft: (option: T) => D;
    /** Why the form can't be saved, or null when it's fine. */
    problem: (draft: D) => string | null;
    /** The form as saved. */
    toSaved: (editing: T, draft: D) => T;
};

/**
 * Every option's id in order after one is moved.
 * @param options The options in their current order.
 * @param index The one moved.
 * @param by Up (-1) or down (1).
 * @returns The ids in the new order.
 */
export const MovedIds = (options: { id?: number }[], index: number, by: number): number[] => {
    const ids = options.map((o) => o.id ?? 0);
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id);
    return ids;
};

/** A delivery option being edited. */
export type DeliveryOptionDraft = {
    name: string;
    price: string;
    isTaxable: boolean;
    isTakeWith: boolean;
    showOnSalesSheet: boolean;
    isActive: boolean;
    sale: SaleDraft;
};

/** Editing a territory's delivery options and in-home services. */
export const DeliveryOptionForm: CatalogOptionForm<DeliveryOption, DeliveryOptionDraft> = {
    blank: { price: 0, isTaxable: true, isActive: true, showOnSalesSheet: true },
    toDraft: (option) => ({
        name: option.name ?? "",
        price: option.price === undefined ? "" : String(option.price),
        isTaxable: option.isTaxable ?? true,
        isTakeWith: option.isTakeWith ?? false,
        showOnSalesSheet: option.showOnSalesSheet ?? true,
        isActive: option.isActive ?? true,
        sale: ToSaleDraft(option.saleDiscountPercent, option.saleDiscountAmount),
    }),
    problem: (draft) => {
        if (!draft.name.trim()) return "Give the option a name.";
        if ((ParseMoney(draft.price) ?? 0) < 0) return "The price cannot be negative.";
        return SaleProblem(draft.sale);
    },
    toSaved: (editing, draft) => {
        const saleOff = FromSaleDraft(draft.sale);
        return {
            id: editing.id,
            name: draft.name.trim(),
            price: ParseMoney(draft.price) ?? 0,
            isTaxable: draft.isTaxable,
            isTakeWith: draft.isTakeWith,
            showOnSalesSheet: draft.showOnSalesSheet,
            isActive: draft.isActive,
            // A new option goes to the end of the list.
            sortOrder: editing.sortOrder,
            saleDiscountPercent: saleOff.percent,
            saleDiscountAmount: saleOff.amount,
        };
    },
};

/** A financing option being edited. */
export type FinanceOptionDraft = { name: string; isActive: boolean };

/** Editing a territory's financing options. */
export const FinanceOptionForm: CatalogOptionForm<FinanceOption, FinanceOptionDraft> = {
    blank: { isActive: true },
    toDraft: (option) => ({ name: option.name ?? "", isActive: option.isActive ?? true }),
    problem: (draft) => (draft.name.trim() ? null : "Give the option a name."),
    toSaved: (editing, draft) => ({
        id: editing.id,
        name: draft.name.trim(),
        isActive: draft.isActive,
    }),
};

/** A category being edited. */
export type CategoryDraft = { name: string };

/** Editing a territory's categories. */
export const CategoryForm: CatalogOptionForm<Category, CategoryDraft> = {
    blank: {},
    toDraft: (category) => ({ name: category.name ?? "" }),
    problem: (draft) => {
        const name = draft.name.trim();
        if (!name) return "Give the category a name.";
        if (name.toLowerCase() === "all") return '"All" is the tab that shows every category.';
        return null;
    },
    toSaved: (editing, draft) => ({ id: editing.id, name: draft.name.trim() }),
};

/**
 * What a category's row says under its name: how many items it has.
 * @param category The category.
 * @returns e.g. "12 items".
 */
export const CategorySummary = (category: Category): string => {
    const count = category.productCount ?? 0;
    return `${count} item${count === 1 ? "" : "s"}`;
};
