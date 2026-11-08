import { useEffect, useState } from "react";
import { Toast } from "@host";
import { useSettingsScope } from "../Context/SettingsScope";
import {
    DashboardProblem,
    FromBusinessDraft,
    FromDashboardDraft,
    FromNewEventDraft,
    FromTerms,
    NewEventChanged,
    NewEventProblem,
    SameTerms,
    TermsProblem,
    ToBusinessDraft,
    ToDashboardDraft,
    ToNewEventDraft,
} from "../Lib/SettingsCards";
import { DefaultGeneralSettings, DefaultSalesTerms } from "../Models/GeneralSettings";
import type { GeneralSettings, SalesTerm } from "../Models/GeneralSettings";
import { SaveGeneralSettings } from "../Services/SettingsServices";

/**
 * One Settings card: its values being edited, and saving them for the scope being edited (the
 * company's or a territory's) so the rest of the screen and the app use them at once.
 * @param toDraft The card's values from the settings in force.
 * @returns The scope, the draft and its handlers.
 */
export const useSettingsCard = <D>(toDraft: (settings: GeneralSettings) => D) => {
    const { settings, apply, territoryId } = useSettingsScope();
    const saved = toDraft(settings);
    const [draft, setDraft] = useState<D>(saved);
    const [saving, setSaving] = useState<boolean>(false);
    const [resetting, setResetting] = useState<boolean>(false);

    // The saved settings can arrive after the card first draws, or change when it saves.
    const savedKey = JSON.stringify(saved);
    useEffect(() => {
        setDraft(JSON.parse(savedKey) as D);
    }, [savedKey]);

    /**
     * Saves changes and puts them in force.
     * @param changes The settings to change.
     * @param done What to say once they're saved.
     * @returns Whether they were saved.
     */
    const save = async (
        changes: Partial<Omit<GeneralSettings, "defaults">>,
        done: string
    ): Promise<boolean> => {
        setSaving(true);
        const result = await SaveGeneralSettings(changes, territoryId);
        setSaving(false);
        if (!result) return false;
        apply(result);
        Toast.Success(done);
        return true;
    };

    return {
        settings,
        /** What resetting goes back to: the app's own values, or for a territory the company's. */
        defaults: settings.defaults ?? DefaultGeneralSettings,
        territoryId,
        isTerritory: territoryId != null,
        /** The card's values as saved. */
        saved,
        draft,
        /** Changes any of the card's values. */
        change: (changes: Partial<D>) => setDraft((d) => ({ ...d, ...changes })),
        setDraft,
        /** Puts the saved values back. */
        discard: () => setDraft(saved),
        saving,
        save,
        /** Whether "go back to the defaults" is waiting to be confirmed. */
        resetting,
        setResetting,
    };
};

/** The Business details card: the app's name, the company on every sales sheet, and the phone. */
export const useBusinessDetailsSettings = () => {
    const card = useSettingsCard(ToBusinessDraft);
    const { settings, defaults, isTerritory, draft } = card;

    const dirty =
        draft.appName.trim() !== settings.appName ||
        draft.company.trim() !== settings.companyName ||
        draft.phone.trim() !== settings.customerServicePhone;
    const isDefault =
        (isTerritory || settings.appName === defaults.appName) &&
        settings.companyName === defaults.companyName &&
        settings.customerServicePhone === defaults.customerServicePhone;

    const handleSave = async () => {
        if (!draft.appName.trim() || !draft.company.trim() || !draft.phone.trim())
            return Toast.Warning(
                "Fill in all three, or use Reset to default to go back to the app's own."
            );
        await card.save(FromBusinessDraft(draft, isTerritory), "Business details saved.");
    };

    const handleReset = async () => {
        card.setResetting(false);
        await card.save(
            FromBusinessDraft(ToBusinessDraft(defaults), isTerritory),
            "Business details are back to the defaults."
        );
    };

    return { ...card, dirty, isDefault, handleSave, handleReset };
};

/** The Dashboard card: when the Net sales tile earns its stars, and the running-low level. */
export const useDashboardSettings = () => {
    const card = useSettingsCard(ToDashboardDraft);
    const { settings, defaults, draft } = card;
    const values = FromDashboardDraft(draft);

    const dirty =
        values.starsFirstAt !== settings.starsFirstAt ||
        values.starsEvery !== settings.starsEvery ||
        values.lowStockAt !== settings.lowStockAt;
    const isDefault =
        settings.starsFirstAt === defaults.starsFirstAt &&
        settings.starsEvery === defaults.starsEvery &&
        settings.lowStockAt === defaults.lowStockAt;

    const handleSave = async () => {
        const problem = DashboardProblem(draft);
        if (problem) return Toast.Warning(problem);
        await card.save(values, "Dashboard settings saved.");
    };

    const handleReset = async () => {
        card.setResetting(false);
        await card.save(
            {
                starsFirstAt: defaults.starsFirstAt,
                starsEvery: defaults.starsEvery,
                lowStockAt: defaults.lowStockAt,
            },
            "Dashboard settings are back to the defaults."
        );
    };

    return { ...card, dirty, isDefault, handleSave, handleReset };
};

/** The Financing card: whether checkout can pick Other and type a kind of financing in. */
export const useFinanceSettings = () => {
    const card = useSettingsCard((s) => ({ allowOther: s.allowOtherFinanceType }));
    const { settings, defaults, draft, territoryId } = card;

    const dirty = draft.allowOther !== settings.allowOtherFinanceType;
    const isDefault = settings.allowOtherFinanceType === defaults.allowOtherFinanceType;

    const handleSave = () =>
        card.save({ allowOtherFinanceType: draft.allowOther }, "Financing settings saved.");

    const handleReset = () =>
        card.save(
            { allowOtherFinanceType: defaults.allowOtherFinanceType },
            territoryId == null
                ? "Financing settings are back to the default."
                : "Financing settings now follow the company's."
        );

    return { ...card, dirty, isDefault, handleSave, handleReset };
};

/** The New events card: the sales tax and card fee a new event starts with. */
export const useNewEventSettings = () => {
    const card = useSettingsCard(ToNewEventDraft);
    const { settings, defaults, draft, saved } = card;

    const dirty = NewEventChanged(draft, saved);
    const isDefault =
        settings.defaultSalesTaxRate === defaults.defaultSalesTaxRate &&
        settings.defaultCcProcessingFeeRate === defaults.defaultCcProcessingFeeRate;

    const handleSave = async () => {
        const problem = NewEventProblem(draft);
        if (problem) return Toast.Warning(problem);
        await card.save(FromNewEventDraft(draft), "New event defaults saved.");
    };

    const handleReset = () =>
        card.save(
            {
                defaultSalesTaxRate: defaults.defaultSalesTaxRate,
                defaultCcProcessingFeeRate: defaults.defaultCcProcessingFeeRate,
            },
            "New event defaults are back to 7% tax and a 2% card fee."
        );

    return { ...card, dirty, isDefault, handleSave, handleReset };
};

/** The Sales sheet terms card: the statements a customer initials. */
export const useTermsSettings = () => {
    const card = useSettingsCard((s) => s.terms);
    const { settings, draft } = card;
    const defaults = settings.defaults?.terms ?? DefaultSalesTerms;

    const dirty = !SameTerms(draft, settings.terms);
    const isDefault = SameTerms(settings.terms, defaults);

    /** Changes one field of one term. */
    const changeTerm = (key: string, field: keyof SalesTerm, value: string) =>
        card.setDraft((current) =>
            current.map((t) => (t.key === key ? { ...t, [field]: value } : t))
        );

    const handleSave = async () => {
        const problem = TermsProblem(draft);
        if (problem) return Toast.Warning(problem);
        await card.save(FromTerms(draft), "Sales sheet terms saved.");
    };

    const handleReset = async () => {
        card.setResetting(false);
        await card.save(
            FromTerms(defaults),
            "Sales sheet terms are back to the paper form's wording."
        );
    };

    return {
        ...card,
        defaultTerms: defaults,
        changeTerm,
        dirty,
        isDefault,
        handleSave,
        handleReset,
    };
};
