import { useEffect, useState } from "react";
import SettingsCard from "./SettingsCard";
import { useSettingsScope } from "./SettingsScope";
import Checkbox from "../Elements/Checkbox";
import { Toast } from "../../Lib/Toast";
import { DefaultGeneralSettings } from "../../Models/GeneralSettings";
import { SaveGeneralSettings } from "../../Services/SettingsServices";

type Props = {
    onLayout?: (id: string, y: number) => void;
};

/**
 * Whether checkout's financing type list ends with Other, for typing in a kind of financing that
 * isn't one of the financing options. The options themselves are kept in the Catalog.
 */
const FinanceSettings = ({ onLayout }: Props) => {
    const { settings, apply, territoryId } = useSettingsScope();
    const defaults = settings.defaults ?? DefaultGeneralSettings;

    const [allowOther, setAllowOther] = useState<boolean>(settings.allowOtherFinanceType);
    const [saving, setSaving] = useState<boolean>(false);

    useEffect(() => {
        setAllowOther(settings.allowOtherFinanceType);
    }, [settings.allowOtherFinanceType]);

    const dirty = allowOther !== settings.allowOtherFinanceType;
    const isDefault = settings.allowOtherFinanceType === defaults.allowOtherFinanceType;

    const save = async (value: boolean) => {
        setSaving(true);
        const result = await SaveGeneralSettings({ allowOtherFinanceType: value }, territoryId);
        setSaving(false);
        if (!result) return false;
        apply(result);
        return true;
    };

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
            dirty={dirty}
            saving={saving}
            onSave={async () => {
                if (await save(allowOther)) Toast.Success("Financing settings saved.");
            }}
            onDiscard={() => setAllowOther(settings.allowOtherFinanceType)}
            onReset={
                isDefault
                    ? undefined
                    : async () => {
                          if (await save(defaults.allowOtherFinanceType))
                              Toast.Success(
                                  territoryId == null
                                      ? "Financing settings are back to the default."
                                      : "Financing settings now follow the company's."
                              );
                      }
            }
            onLayout={onLayout}
        >
            <Checkbox
                label="Offer “Other” at checkout"
                checked={allowOther}
                onChange={setAllowOther}
            />
        </SettingsCard>
    );
};

export default FinanceSettings;
