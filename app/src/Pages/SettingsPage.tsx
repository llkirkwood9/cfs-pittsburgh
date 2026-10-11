import { useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Icon from "../Components/Elements/Icon";
import Page from "../Components/Elements/Page";
import Text from "../Components/Elements/Text";
import BusinessDetailsSettings from "../Components/Settings/BusinessDetailsSettings";
import DashboardSettings from "../Components/Settings/DashboardSettings";
import FinanceSettings from "../Components/Settings/FinanceSettings";
import NewEventSettings from "../Components/Settings/NewEventSettings";
import ReceiptEmailSettings from "../Components/Settings/ReceiptEmailSettings";
import TermsSettings from "../Components/Settings/TermsSettings";

const sections = [
    { id: "business", label: "Business details", icon: "fa-solid fa-building" },
    { id: "terms", label: "Sales sheet terms", icon: "fa-solid fa-file-signature" },
    { id: "receipt-email", label: "Receipt email", icon: "fa-solid fa-envelope" },
    { id: "financing", label: "Financing", icon: "fa-solid fa-file-invoice-dollar" },
    { id: "events", label: "New events", icon: "fa-solid fa-calendar-plus" },
    { id: "dashboard", label: "Dashboard", icon: "fa-solid fa-chart-column" },
];

/**
 * Settings an administrator changes for everyone: the business details printed on sheets and
 * emails, the terms customers initial, the receipt email's wording, the finance options, new
 * events' rates and the dashboard's levels. Each card saves on its own.
 */
const SettingsPage = () => {
    const scrollRef = useRef<ScrollView>(null);
    // Where each card starts within the list of cards, and where that list starts on the page.
    const positions = useRef<Record<string, number>>({});
    const listTop = useRef<number>(0);

    const place = (id: string, y: number) => {
        positions.current[id] = y;
    };

    const jump = (id: string) => {
        const y = positions.current[id];
        if (y === undefined) return;
        scrollRef.current?.scrollTo({ y: Math.max(0, listTop.current + y - 8), animated: true });
    };

    return (
        <Page edges={["left", "right"]} scrollRef={scrollRef}>
            <View className="mx-auto w-full max-w-6xl">
                <Text className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                    These apply to everyone using the app. Each section saves on its own.
                </Text>

                <View
                    accessibilityLabel="Settings sections"
                    className="mb-4 flex-row flex-wrap gap-2"
                >
                    {sections.map((s) => (
                        <Pressable
                            key={s.id}
                            onPress={() => jump(s.id)}
                            accessibilityRole="link"
                            className="min-h-[40px] flex-row items-center gap-2 rounded-full border border-zinc-300 bg-white px-3
                                active:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800"
                        >
                            <Icon icon={s.icon} className="text-xs text-zinc-700 dark:text-zinc-200" />
                            <Text className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                                {s.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <View className="gap-4" onLayout={(e) => (listTop.current = e.nativeEvent.layout.y)}>
                    <BusinessDetailsSettings onLayout={place} />
                    <TermsSettings onLayout={place} />
                    <ReceiptEmailSettings onLayout={place} />
                    <FinanceSettings onLayout={place} />
                    <NewEventSettings onLayout={place} />
                    <DashboardSettings onLayout={place} />
                </View>
            </View>
        </Page>
    );
};

export default SettingsPage;
