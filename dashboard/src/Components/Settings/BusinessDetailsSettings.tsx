import ConfirmationModal from "../Elements/ConfirmationModal";
import TextField from "../Elements/TextField";
import SettingsCard from "./SettingsCard";
import { useBusinessDetailsSettings } from "@shared/Hooks/useSettingsCard";
import { BusinessLimits } from "@shared/Lib/SettingsCards";

/**
 * The names and number printed on sheets and emails: the app's name, the company named on every
 * sales sheet, and the customer service phone.
 */
const BusinessDetailsSettings = () => {
    const card = useBusinessDetailsSettings();
    const { draft, defaults, isTerritory } = card;

    return (
        <SettingsCard
            id="business"
            title="Business details"
            icon="fa-solid fa-building"
            description="The names and number printed on sales sheets and in emails."
            status={card.isDefault ? "Using the default details." : "Using your own details."}
            dirty={card.dirty}
            saving={card.saving}
            onSave={card.handleSave}
            onDiscard={card.discard}
            onReset={card.isDefault ? undefined : () => card.setResetting(true)}
        >
            <div className={`grid gap-4 ${isTerritory ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                <TextField
                    label="Company name"
                    value={draft.company}
                    onChange={(value) => card.change({ company: value })}
                    maxLength={BusinessLimits.company}
                    placeholder={defaults.companyName}
                />
                <TextField
                    label="Customer service phone"
                    type="tel"
                    inputMode="tel"
                    value={draft.phone}
                    onChange={(value) => card.change({ phone: value })}
                    maxLength={BusinessLimits.phone}
                    placeholder={defaults.customerServicePhone}
                />
                {/* The app's name is company-wide, so a territory's own settings leave it out. */}
                {!isTerritory && (
                    <TextField
                        label="App name"
                        value={draft.appName}
                        onChange={(value) => card.change({ appName: value })}
                        maxLength={BusinessLimits.appName}
                        placeholder={defaults.appName}
                    />
                )}
            </div>

            {card.resetting && (
                <ConfirmationModal
                    title="Go back to the default details"
                    message={
                        isTerritory
                            ? `Follow the company-wide details again ("${defaults.companyName}", ${defaults.customerServicePhone})?`
                            : `Use "${defaults.companyName}", ${defaults.customerServicePhone} and "${defaults.appName}" again?`
                    }
                    confirmText="Use the defaults"
                    onConfirm={card.handleReset}
                    onCancel={() => card.setResetting(false)}
                />
            )}
        </SettingsCard>
    );
};

export default BusinessDetailsSettings;
