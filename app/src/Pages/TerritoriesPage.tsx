import { useState } from "react";
import { View } from "react-native";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import Page from "../Components/Elements/Page";
import SelectField from "../Components/Elements/SelectField";
import SwipeRow from "../Components/Elements/SwipeRow";
import type { SwipeAction } from "../Components/Elements/SwipeRow";
import Text from "../Components/Elements/Text";
import TextField from "../Components/Elements/TextField";
import { useTerritories } from "@shared/Hooks/useTerritories";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";

/**
 * Territories, for system admins and administrators. Each one has its own crew, events, stock,
 * catalog items and settings; managers look after a single territory. Tap a territory to rename
 * it; swipe it to work in it, switch it off or on, or delete it while nothing belongs to it yet.
 */
const TerritoriesPage = () => {
    const page = useTerritories();
    const { territories, editing, switchingOff, deleting } = page;
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Back on this screen: read it again.
    useRefreshOnFocus(page.load);

    const handleRefresh = async () => {
        setRefreshing(true);
        await page.load();
        setRefreshing(false);
    };

    if (page.loading) {
        return (
            <Page edges={["left", "right"]}>
                <ListSkeleton rows={3} />
            </Page>
        );
    }

    return (
        <Page edges={["left", "right"]} onRefresh={handleRefresh} refreshing={refreshing}>
            <View className="mx-auto w-full max-w-3xl">
                <View className="mb-4 flex-row items-center justify-end">
                    <Button
                        text="Add territory"
                        icon="fa-solid fa-plus"
                        onClick={page.add}
                        className="bg-green-700 dark:bg-green-600"
                    />
                </View>

                {territories.length === 0 && (
                    <Text className="rounded-xl bg-white p-6 text-center text-sm text-zinc-500 raised-sm dark:bg-zinc-800 dark:text-zinc-400">
                        No territories yet. Add one to start taking events.
                    </Text>
                )}

                <View className="gap-2">
                    {territories.map((territory) => {
                        const off = territory.isActive === false;
                        const empty =
                            !territory.userCount &&
                            !territory.eventCount &&
                            !territory.productCount;
                        const actions: SwipeAction[] = [
                            ...(!off
                                ? [
                                      {
                                          label: "View",
                                          icon: "fa-solid fa-eye",
                                          tone: "sky" as const,
                                          onPress: () => page.workIn(territory),
                                      },
                                  ]
                                : []),
                            off
                                ? {
                                      label: "Switch on",
                                      icon: "fa-solid fa-power-off",
                                      tone: "neutral" as const,
                                      onPress: () => page.setActive(territory, true),
                                  }
                                : {
                                      label: "Switch off",
                                      icon: "fa-solid fa-power-off",
                                      tone: "danger" as const,
                                      onPress: () => page.setSwitchingOff(territory),
                                  },
                            ...(empty
                                ? [
                                      {
                                          label: "Delete",
                                          icon: "fa-solid fa-trash",
                                          tone: "danger" as const,
                                          onPress: () => page.setDeleting(territory),
                                      },
                                  ]
                                : []),
                        ];

                        return (
                            <SwipeRow
                                key={territory.id}
                                onPress={() => page.open(territory)}
                                actions={actions}
                                accessibilityLabel={`${territory.name}${off ? ", switched off" : ""}`}
                                className="p-4"
                            >
                                <View className="flex-row items-center gap-2">
                                    <Text className="shrink font-semibold" numberOfLines={1}>
                                        {territory.name}
                                    </Text>
                                    {off && (
                                        <View className="rounded bg-zinc-200 px-1.5 py-0.5 dark:bg-zinc-700">
                                            <Text className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                Off
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {territory.userCount ?? 0} crew · {territory.eventCount ?? 0}{" "}
                                    events · {territory.productCount ?? 0} own catalog items
                                </Text>
                                {territory.activeEvent ? (
                                    <View className="mt-0.5 flex-row items-center gap-1.5">
                                        <Icon
                                            icon="fa-solid fa-circle-play"
                                            className="text-xs text-green-700 dark:text-green-400"
                                        />
                                        <Text className="text-xs text-green-700 dark:text-green-400">
                                            Active event: {territory.activeEvent}
                                        </Text>
                                    </View>
                                ) : null}
                            </SwipeRow>
                        );
                    })}
                </View>
            </View>

            {editing && (
                <Modal
                    title={editing.id ? "Rename territory" : "Add territory"}
                    onClose={page.close}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={page.close}
                                className="bg-zinc-500 dark:bg-zinc-600"
                            />
                            <Button
                                text="Save"
                                icon="fa-solid fa-check"
                                onClick={page.save}
                                loading={page.saving}
                            />
                        </>
                    }
                >
                    <TextField
                        label="Name"
                        value={page.name}
                        onChange={page.setName}
                        onSubmit={page.save}
                        maxLength={100}
                        autoFocus
                        autoCapitalize="words"
                    />
                    {!editing.id && (
                        <>
                            <SelectField<number | null>
                                label="Catalog"
                                value={page.copyFrom}
                                options={[
                                    { value: null, label: "Start with an empty catalog" },
                                    ...page.copySources.map((t) => ({
                                        value: t.id ?? null,
                                        label: `Copy ${t.name}'s catalog`,
                                    })),
                                ]}
                                onChange={page.setCopyFrom}
                                className="mt-3"
                            />
                            <Text className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                                Each territory has its own catalog. A copy brings every product with
                                its sizes, prices and sales, and the delivery and financing options
                                - but not stock. It starts with the company-wide settings.
                            </Text>
                        </>
                    )}
                </Modal>
            )}

            {switchingOff && (
                <ConfirmationModal
                    title="Switch territory off"
                    message={`Switch ${switchingOff.name} off? Its crew are signed out and can't sign back in, and its active event is closed, until it is switched back on. Nothing is deleted.`}
                    confirmText="Switch off"
                    destructive
                    onConfirm={() => page.setActive(switchingOff, false)}
                    onCancel={() => page.setSwitchingOff(null)}
                />
            )}

            {deleting && (
                <ConfirmationModal
                    title="Delete territory"
                    message={`Delete ${deleting.name}? Nothing belongs to it yet, so nothing else is affected.`}
                    confirmText="Delete"
                    destructive
                    onConfirm={page.confirmDelete}
                    onCancel={() => page.setDeleting(null)}
                />
            )}
        </Page>
    );
};

export default TerritoriesPage;
