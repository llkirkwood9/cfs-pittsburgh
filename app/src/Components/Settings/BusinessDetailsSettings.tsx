import { useEffect, useState } from "react";
import SettingsCard from "./SettingsCard";
import { useSettingsScope } from "./SettingsScope";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Grid from "../Elements/Grid";
import TextField from "../Elements/TextField";
import { Toast } from "../../Lib/Toast";
import { DefaultGeneralSettings } from "../../Models/GeneralSettings";

import { SaveGeneralSettings } from "../../Services/SettingsServices";

/** Matches the server's limits. */
const MAX_APP_NAME = 30;
const MAX_COMPANY = 60;
const MAX_PHONE = 30;

type Props = {
    onLayout?: (id: string, y: number) => void;
};

/**
 * The names and number printed on sheets and emails: the app's name, the company named on every
 * sales sheet, and the customer service phone.
 */
const BusinessDetailsSettings = ({ onLayout }: Props) => {
    const { settings, apply, territoryId } = useSettingsScope();
    const isTerritory = territoryId != null;
    const defaults = settings.defaults ?? DefaultGeneralSettings;

    const [appName, setAppName] = useState<string>(settings.appName);
    const [company, setCompany] = useState<string>(settings.companyName);
    const [phone, setPhone] = useState<string>(settings.customerServicePhone);
    const [saving, setSaving] = useState<boolean>(false);
    const [resetting, setResetting] = useState<boolean>(false);

    // The saved settings can arrive after the card first draws.
    useEffect(() => {
        setAppName(settings.appName);
        setCompany(settings.companyName);
        setPhone(settings.customerServicePhone);
    }, [settings.appName, settings.companyName, settings.customerServicePhone]);

    const dirty =
        appName.trim() !== settings.appName ||
        company.trim() !== settings.companyName ||
        phone.trim() !== settings.customerServicePhone;
    const isDefault =
        (isTerritory || settings.appName === defaults.appName) &&
        settings.companyName === defaults.companyName &&
        settings.customerServicePhone === defaults.customerServicePhone;

    const save = async (values: { appName: string; companyName: string; phone: string }) => {
        setSaving(true);
        const result = await SaveGeneralSettings(
            {
                // The app's name is the same everywhere, so only the company-wide settings set it.
                ...(isTerritory ? {} : { appName: values.appName.trim() }),
                companyName: values.companyName.trim(),
                customerServicePhone: values.phone.trim(),
            },
            territoryId
        );
        setSaving(false);
        if (!result) return false;
        apply(result);
        return true;
    };

    const handleSave = async () => {
        if (!appName.trim() || !company.trim() || !phone.trim())
            return Toast.Warning(
                "Fill in all three, or use Reset to default to go back to the app's own."
            );
        if (await save({ appName, companyName: company, phone }))
            Toast.Success("Business details saved.");
    };

    const handleReset = async () => {
        setResetting(false);
        if (
            await save({
                appName: defaults.appName,
                companyName: defaults.companyName,
                phone: defaults.customerServicePhone,
            })
        )
            Toast.Success("Business details are back to the defaults.");
    };

    return (
        <SettingsCard
            id="business"
            title="Business details"
            icon="fa-solid fa-building"
            description="The names and number printed on sales sheets and in emails."
            status={isDefault ? "Using the default details." : "Using your own details."}
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onDiscard={() => {
                setAppName(settings.appName);
                setCompany(settings.companyName);
                setPhone(settings.customerServicePhone);
            }}
            onReset={isDefault ? undefined : () => setResetting(true)}
            onLayout={onLayout}
        >
            <Grid columns={{ base: 1, md: 3 }} gap={16}>
                <TextField
                    label="Company name"
                    value={company}
                    onChange={setCompany}
                    maxLength={MAX_COMPANY}
                    placeholder={defaults.companyName}
                    autoCapitalize="words"
                />
                <TextField
                    label="Customer service phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={setPhone}
                    maxLength={MAX_PHONE}
                    placeholder={defaults.customerServicePhone}
                />
                {/* The app's name is company-wide, so a territory's own settings leave it out. */}
                {!isTerritory && (
                    <TextField
                        label="App name"
                        value={appName}
                        onChange={setAppName}
                        maxLength={MAX_APP_NAME}
                        placeholder={defaults.appName}
                        autoCapitalize="words"
                    />
                )}
            </Grid>

            {resetting && (
                <ConfirmationModal
                    title="Go back to the default details"
                    message={
                        isTerritory
                            ? `Follow the company-wide details again ("${defaults.companyName}", ${defaults.customerServicePhone})?`
                            : `Use "${defaults.companyName}", ${defaults.customerServicePhone} and "${defaults.appName}" again?`
                    }
                    confirmText="Use the defaults"
                    onConfirm={handleReset}
                    onCancel={() => setResetting(false)}
                />
            )}
        </SettingsCard>
    );
};

export default BusinessDetailsSettings;
