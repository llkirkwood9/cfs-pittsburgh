import Icon from "../Components/Elements/Icon";
import BusinessDetailsSettings from "../Components/Settings/BusinessDetailsSettings";
import DashboardSettings from "../Components/Settings/DashboardSettings";
import ReceiptEmailSettings from "../Components/Settings/ReceiptEmailSettings";

const sections = [
    { id: "business", label: "Business details", icon: "fa-solid fa-building" },
    { id: "receipt-email", label: "Receipt email", icon: "fa-solid fa-envelope" },
    { id: "dashboard", label: "Dashboard", icon: "fa-solid fa-chart-column" },
];

/**
 * Settings an administrator changes for everyone: the business details printed on sheets and
 * emails, the receipt email's wording, and the dashboard's levels. Each card saves on its own.
 */
const SettingsPage = () => {
    return (
        <div className="mx-auto max-w-6xl p-3 sm:p-4">
            <h1 className="mb-1 text-xl font-bold">Settings</h1>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                These apply to everyone using the app. Each section saves on its own.
            </p>

            <nav aria-label="Settings sections" className="mb-4 flex flex-wrap gap-2">
                {sections.map((s) => (
                    <a
                        key={s.id}
                        href={`#${s.id}`}
                        onClick={(e) => {
                            e.preventDefault();
                            document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 text-sm font-semibold
                            text-zinc-700 hover:border-sky-600 hover:text-sky-800
                            dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:text-sky-200"
                    >
                        <Icon icon={s.icon} className="text-xs" />
                        {s.label}
                    </a>
                ))}
            </nav>

            <div className="space-y-4">
                <BusinessDetailsSettings />
                <ReceiptEmailSettings />
                <DashboardSettings />
            </div>
        </div>
    );
};

export default SettingsPage;
