import { useState } from "react";
import { Pressable, View } from "react-native";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import Text from "../Elements/Text";
import { useTerritory } from "../../Context/TerritoryContext";
import { cx } from "../../Lib/ClassNames";

/**
 * The territory in view, in the menu bar. System Admins and administrators switch between
 * territories - or all of them - here; everyone else just sees which territory they're in.
 */
const TerritoryPicker = () => {
    const { territories, territoryId, territoryName, canSwitch, setTerritoryId } = useTerritory();
    const [open, setOpen] = useState<boolean>(false);

    if (!canSwitch) {
        if (!territoryName) return null;
        return (
            <View className="max-w-[120px] flex-row items-center gap-1.5 px-1" accessibilityLabel={`Territory: ${territoryName}`}>
                <Icon icon="fa-solid fa-location-dot" className="text-sm text-sky-400" />
                <Text className="shrink text-sm font-medium text-zinc-300" numberOfLines={1}>
                    {territoryName}
                </Text>
            </View>
        );
    }

    const active = territories.filter((t) => t.isActive !== false);
    const choices: { id: number | null; name: string }[] = [
        { id: null, name: "All territories" },
        ...active.map((t) => ({ id: t.id ?? null, name: t.name ?? "" })),
    ];

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Territory in view: ${territoryName}. Change it`}
                className="h-11 max-w-[140px] flex-row items-center gap-1.5 rounded-xl bg-white/10 px-2.5 active:bg-white/20"
            >
                <Icon icon="fa-solid fa-location-dot" className="text-sm text-sky-400" />
                <Text className="shrink text-sm font-medium text-white" numberOfLines={1}>
                    {territoryName}
                </Text>
                <Icon icon="fa-solid fa-chevron-down" className="text-[10px] text-zinc-300" />
            </Pressable>

            {open && (
                <Modal title="Territory" onClose={() => setOpen(false)}>
                    <View className="gap-1">
                        {choices.map((c) => {
                            const selected = c.id === territoryId;
                            return (
                                <Pressable
                                    key={c.id ?? "all"}
                                    onPress={() => {
                                        setTerritoryId(c.id);
                                        setOpen(false);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                    className={cx(
                                        "min-h-[48px] flex-row items-center gap-3 rounded-lg px-3",
                                        selected
                                            ? "bg-sky-50 dark:bg-sky-950/50"
                                            : "active:bg-zinc-100 dark:active:bg-zinc-700"
                                    )}
                                >
                                    <Icon
                                        icon={c.id == null ? "fa-solid fa-earth-americas" : "fa-solid fa-location-dot"}
                                        className="w-5 text-zinc-500 dark:text-zinc-400"
                                    />
                                    <Text
                                        className={cx(
                                            "flex-1 text-base",
                                            selected ? "font-semibold text-sky-800 dark:text-sky-200" : "font-medium"
                                        )}
                                    >
                                        {c.name}
                                    </Text>
                                    {selected && (
                                        <Icon icon="fa-solid fa-check" className="text-sky-700 dark:text-sky-300" />
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                </Modal>
            )}
        </>
    );
};

export default TerritoryPicker;
