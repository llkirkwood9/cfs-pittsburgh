import { FormatCurrency, PercentAsRate, RateAsPercent } from "./Format";
import type { GeneralSettings, SalesTerm } from "../Models/GeneralSettings";
import { MAX_DEFAULT_EVENT_RATE_PERCENT } from "./Limits";

/** The Settings screen's sections, in order, for the links at the top. */
export const SettingsSections = [
    { id: "business", label: "Business details", icon: "fa-solid fa-building" },
    { id: "terms", label: "Sales sheet terms", icon: "fa-solid fa-file-signature" },
    { id: "receipt-email", label: "Receipt email", icon: "fa-solid fa-envelope" },
    { id: "financing", label: "Financing", icon: "fa-solid fa-file-invoice-dollar" },
    { id: "events", label: "New events", icon: "fa-solid fa-calendar-plus" },
    { id: "dashboard", label: "Dashboard", icon: "fa-solid fa-chart-column" },
];

/** Business details' lengths, matching the server's limits. */
export const BusinessLimits = { appName: 30, company: 60, phone: 30 };

/** Business details being edited. */
export type BusinessDraft = { appName: string; company: string; phone: string };

/** Business details as the card shows them. */
export const ToBusinessDraft = (settings: GeneralSettings): BusinessDraft => ({
    appName: settings.appName,
    company: settings.companyName,
    phone: settings.customerServicePhone,
});

/**
 * Business details as saved. The app's name is the same everywhere, so only the company-wide
 * settings set it.
 * @param draft The details.
 * @param isTerritory Whether a territory's settings are being saved.
 * @returns The changes.
 */
export const FromBusinessDraft = (
    draft: BusinessDraft,
    isTerritory: boolean
): Partial<GeneralSettings> => ({
    ...(isTerritory ? {} : { appName: draft.appName.trim() }),
    companyName: draft.company.trim(),
    customerServicePhone: draft.phone.trim(),
});

/** The dashboard's levels, matching the server's limits. */
export const DashboardLimits = { amount: 10_000_000, low: 999 };

/**
 * Reads a typed amount such as "30,000" or "$30000".
 * @param value What was typed.
 * @returns The amount, or NaN.
 */
export const ParseAmount = (value: string): number => Number(value.replace(/[$,\s]/g, ""));

/** The dashboard's levels being edited, as typed. */
export type DashboardDraft = { firstAt: string; every: string; lowAt: string };

/** The dashboard's levels as the card shows them. */
export const ToDashboardDraft = (settings: GeneralSettings): DashboardDraft => ({
    firstAt: String(settings.starsFirstAt),
    every: String(settings.starsEvery),
    lowAt: String(settings.lowStockAt),
});

/**
 * The dashboard's levels as saved.
 * @param draft The levels as typed.
 * @returns The levels.
 */
export const FromDashboardDraft = (draft: DashboardDraft) => ({
    starsFirstAt: ParseAmount(draft.firstAt),
    starsEvery: ParseAmount(draft.every),
    lowStockAt: Number(draft.lowAt.trim()),
});

/**
 * Why the dashboard's levels can't be saved, or null when they're fine.
 * @param draft The levels as typed.
 * @returns A message, or null.
 */
export const DashboardProblem = (draft: DashboardDraft): string | null => {
    const { starsFirstAt, starsEvery, lowStockAt } = FromDashboardDraft(draft);
    const amountOk = (n: number) => Number.isFinite(n) && n > 0 && n <= DashboardLimits.amount;
    if (!amountOk(starsFirstAt) || !amountOk(starsEvery))
        return `Star amounts must be more than $0 and at most ${FormatCurrency(DashboardLimits.amount)}.`;
    const lowOk =
        draft.lowAt.trim() !== "" &&
        Number.isInteger(lowStockAt) &&
        lowStockAt >= 0 &&
        lowStockAt <= DashboardLimits.low;
    if (!lowOk) return `Running low must be a whole number from 0 to ${DashboardLimits.low}.`;
    return null;
};

/** New events' rates being edited, as typed percents. */
export type NewEventDraft = { tax: string; fee: string };

/** New events' rates as the card shows them. */
export const ToNewEventDraft = (settings: GeneralSettings): NewEventDraft => ({
    tax: RateAsPercent(settings.defaultSalesTaxRate),
    fee: RateAsPercent(settings.defaultCcProcessingFeeRate),
});

/**
 * Why new events' rates can't be saved, or null when they're fine.
 * @param draft The rates as typed.
 * @returns A message, or null.
 */
export const NewEventProblem = (draft: NewEventDraft): string | null => {
    const ok = (rate: number) =>
        Number.isFinite(rate) && rate >= 0 && rate <= MAX_DEFAULT_EVENT_RATE_PERCENT / 100;
    return ok(PercentAsRate(draft.tax)) &&
        ok(PercentAsRate(draft.fee)) &&
        draft.tax.trim() &&
        draft.fee.trim()
        ? null
        : `Enter each rate as a percent from 0 to ${MAX_DEFAULT_EVENT_RATE_PERCENT}.`;
};

/**
 * New events' rates as saved.
 * @param draft The rates as typed.
 * @returns The rates.
 */
export const FromNewEventDraft = (draft: NewEventDraft) => ({
    defaultSalesTaxRate: Number(PercentAsRate(draft.tax).toFixed(6)),
    defaultCcProcessingFeeRate: Number(PercentAsRate(draft.fee).toFixed(6)),
});

/**
 * Whether new events' rates as typed differ from the saved ones. Compared as typed percents so 7
 * and 7.0 aren't seen as a change.
 */
export const NewEventChanged = (draft: NewEventDraft, saved: NewEventDraft): boolean =>
    RateAsPercent(PercentAsRate(draft.tax)) !== saved.tax ||
    RateAsPercent(PercentAsRate(draft.fee)) !== saved.fee;

/** The terms' lengths, matching the server's limits. */
export const TermsLimits = { text: 1200, heading: 60 };

/**
 * Whether terms being edited say the same as saved ones, ignoring spaces around them.
 * @param a The terms being edited.
 * @param b The saved terms.
 * @returns True when nothing changed.
 */
export const SameTerms = (a: SalesTerm[], b: SalesTerm[]): boolean =>
    a.length === b.length &&
    a.every(
        (t, i) =>
            t.key === b[i].key &&
            t.title.trim() === b[i].title &&
            t.heading.trim() === b[i].heading &&
            t.text.trim() === b[i].text &&
            (t.askWhen ?? "always") === (b[i].askWhen ?? "always")
    );

/**
 * Why the terms can't be saved, or null when they're fine.
 * @param terms The terms.
 * @returns A message, or null.
 */
export const TermsProblem = (terms: SalesTerm[]): string | null => {
    const empty = terms.find((t) => !t.text.trim());
    return empty ? `"${empty.title}" needs its paragraph - customers initial it.` : null;
};

/**
 * The terms as saved, trimmed.
 * @param terms The terms.
 * @returns The changes.
 */
export const FromTerms = (terms: SalesTerm[]): Partial<GeneralSettings> => ({
    terms: terms.map((t) => ({
        ...t,
        title: t.title.trim(),
        heading: t.heading.trim(),
        text: t.text.trim(),
    })),
});

/**
 * Puts a receipt email placeholder such as {CustomerName} in place of the selected text.
 * @param value The field's text.
 * @param at Where the cursor or selection is.
 * @param name The placeholder's name.
 * @param maxLength How long the field can be.
 * @returns The new text and where the cursor goes after it, or null when it would be too long.
 */
export const InsertPlaceholder = (
    value: string,
    at: { start: number; end: number },
    name: string,
    maxLength: number
): { text: string; caret: number } | null => {
    const token = `{${name}}`;
    const text = value.slice(0, at.start) + token + value.slice(at.end);
    return text.length > maxLength ? null : { text, caret: at.start + token.length };
};
