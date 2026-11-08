import SettingsCard from "./SettingsCard";
import { useFinanceSettings } from "@shared/Hooks/useSettingsCard";
import Checkbox from "../Elements/Checkbox";

type Props = {
    onLayout?: (id: string, y: number) => void;
};

/**
 * Whether checkout's financing type list ends with Other, for typing in a kind of financing that
 * isn't one of the financing options. The options themselves are kept in the Catalog.
 */
const FinanceSettings = ({ onLayout }: Props) => {
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
            onLayout={onLayout}
        >
            <Checkbox
                label="Offer “Other” at checkout"
                checked={draft.allowOther}
                onChange={(value) => card.change({ allowOther: value })}
            />
        </SettingsCard>
    );
};

export default FinanceSettings;
