import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Icon from "../Components/Elements/Icon";
import Page from "../Components/Elements/Page";
import Text from "../Components/Elements/Text";
import { useTerritory } from "../Context/TerritoryContext";

type Props = {
    children: ReactNode;
    /** What the screen is for, e.g. "take orders". */
    purpose: string;
    /** A screen opened within More has its own header, so no menu bar. */
    inStack?: boolean;
};

/**
 * For screens that work in one territory at a time - selling, checkout, stock counts. Crew are
 * always in their own; a system admin or administrator viewing every territory is asked to pick one.
 */
const RequireTerritory = ({ children, purpose, inStack = false }: Props) => {
    const { territoryId, territories, canSwitch, setTerritoryId } = useTerritory();

    if (territoryId != null || !canSwitch) return <>{children}</>;

    const active = territories.filter((t) => t.isActive !== false);

    return (
        <Page navbar={!inStack} edges={inStack ? ["left", "right"] : undefined}>
            <View className="mx-auto w-full max-w-lg items-center rounded-2xl bg-white p-6 raised-sm dark:bg-zinc-800">
                <Icon
                    icon="fa-solid fa-map-location-dot"
                    className="mb-3 text-3xl text-sky-600 dark:text-sky-400"
                />
                <Text className="mb-1 text-lg font-bold">Pick a territory</Text>
                <Text className="mb-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    You&apos;re viewing every territory. To {purpose}, choose which one you&apos;re
                    working in.
                </Text>
                {active.length === 0 ? (
                    <Text className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                        There are no territories yet. Add one under More, Territories.
                    </Text>
                ) : (
                    <View className="flex-row flex-wrap justify-center gap-2">
                        {active.map((t) => (
                            <Pressable
                                key={t.id}
                                onPress={() => setTerritoryId(t.id ?? null)}
                                accessibilityRole="button"
                                className="min-h-[48px] items-center justify-center rounded-xl bg-sky-700 px-4 active:opacity-80 dark:bg-sky-600"
                            >
                                <Text className="text-sm font-semibold text-white">{t.name}</Text>
                            </Pressable>
                        ))}
                    </View>
                )}
            </View>
        </Page>
    );
};

export default RequireTerritory;
