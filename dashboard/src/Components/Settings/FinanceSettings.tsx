import SettingsCard from "./SettingsCard";
import { useFinanceSettings } from "@shared/Hooks/useSettingsCard";

/**
 * Whether checkout's financing type list ends with Other, for typing in a kind of financing that
 * isn't one of the financing options. The options themselves are kept in the Catalog. A
 * territory follows the company's choice until it saves its own.
 */
const FinanceSettings = () => {
    const card = useFinanceSettings();
    const { settings, draft } = card;

    return (
        <SettingsCard
            id="financing"
            title="Financing"
            icon="fa-solid fa-file-invoice-dollar"
            description="How checkout records the type of financing."
            status={
                settings.allowOtherFinanceType
                    ? "Checkout can pick Other and type a financing type in."
                    : "Checkout can only pick one of the financing options."
            }
            dirty={card.dirty}
            saving={card.saving}
            onSave={card.handleSave}
            onDiscard={card.discard}
            onReset={card.isDefault ? undefined : card.handleReset}
        >
            <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-700">
                <input
                    type="checkbox"
                    checked={draft.allowOther}
                    onChange={(e) => card.change({ allowOther: e.target.checked })}
                    className="h-5 w-5 accent-sky-600"
                />
                <span className="text-sm">
                    <span className="font-medium">Offer &ldquo;Other&rdquo; at checkout</span>
                </span>
            </label>
        </SettingsCard>
    );
};

export default FinanceSettings;
