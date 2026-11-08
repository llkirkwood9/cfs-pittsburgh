import { router, Stack, useLocalSearchParams } from "expo-router";
import { TextInput, View } from "react-native";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import GlassPanel from "../Components/Elements/GlassPanel";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Page from "../Components/Elements/Page";
import Text from "../Components/Elements/Text";
import TextField from "../Components/Elements/TextField";
import { useTheme } from "../Hooks/UseTheme";
import { cx } from "../Lib/ClassNames";
import { useInventoryCount } from "@shared/Hooks/useInventoryCount";
import { CategoryNames } from "@shared/Lib/Catalog";
import { InventoryRowKey, InventorySizeLabel } from "@shared/Lib/Inventory";
import { CountPhaseFrom } from "@shared/Lib/InventoryCount";

/**
 * A shelf count for the active event: the start-of-event count before the doors open, or the
 * end-of-event count once they close. Checkout works down the list entering what is actually on
 * the shelf; saving sets every counted size to what was found and records the count against the
 * event, so the Accessory Inventory Sheet shows what the event started with, what the app expected
 * at the end and what was really left.
 */
const InventoryCountPage = () => {
    const { isDark } = useTheme();
    const params = useLocalSearchParams<{ phase: string }>();
    const phase = CountPhaseFrom(params.phase);
    const {
        text,
        saleEvent,
        items,
        groups,
        counts,
        countFor,
        setCount,
        fillBlanks,
        note,
        setNote,
        loading,
        progress: { entered, differences, blanks },
        review,
        confirming,
        setConfirming,
        confirmMessage,
        saving,
        save,
    } = useInventoryCount(phase);

    const header = <Stack.Screen options={{ title: text.title }} />;

    if (loading) {
        return (
            <Page edges={["left", "right"]}>
                {header}
                <ListSkeleton rows={6} />
            </Page>
        );
    }

    if (!saleEvent) {
        return (
            <Page edges={["left", "right"]}>
                {header}
                <View className="mx-auto max-w-lg items-center p-6">
                    <Icon icon="fa-solid fa-calendar-xmark" className="text-3xl text-zinc-400" />
                    <Text className="mt-3 text-xl font-bold">No active event</Text>
                    <Button
                        text="Back to inventory"
                        icon="fa-solid fa-arrow-left"
                        onClick={() => router.back()}
                        className="mt-4 bg-zinc-500"
                    />
                </View>
            </Page>
        );
    }

    return (
        <Page
            edges={["left", "right", "bottom"]}
            className="pb-6"
            overlay={
                <View className="px-3 pb-2 pt-1">
                    <GlassPanel className="mx-auto w-full max-w-4xl rounded-2xl p-3 raised-lg">
                        <View className="flex-row flex-wrap items-center gap-3">
                            <Text className="flex-1 text-sm">
                                <Text className="text-sm font-bold">
                                    {entered.length} of {items.length}
                                </Text>{" "}
                                sizes counted
                                {differences.length > 0 && (
                                    <Text className="text-sm text-amber-700 dark:text-amber-400">
                                        {" "}
                                        · {differences.length} differ
                                    </Text>
                                )}
                            </Text>
                            <Button
                                text="Save count"
                                icon="fa-solid fa-clipboard-check"
                                onClick={review}
                                disabled={entered.length === 0}
                                className="bg-green-700 dark:bg-green-600"
                            />
                        </View>
                    </GlassPanel>
                </View>
            }
        >
            {header}
            <View className="mx-auto w-full max-w-4xl">
                <Text className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {saleEvent.organization}. {text.intro} Leave a size blank to skip it.
                </Text>

                {blanks > 0 && (
                    <Button
                        text="Fill the rest as matching"
                        icon="fa-solid fa-check-double"
                        onClick={fillBlanks}
                        className="mb-4 self-start bg-zinc-500 dark:bg-zinc-600"
                    />
                )}

                <View className="gap-6">
                    {groups.map((group) => (
                        <View key={group.category}>
                            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                {CategoryNames[group.category]}
                            </Text>
                            <View className="gap-3">
                                {group.products.map((product) => (
                                    <View
                                        key={product.productId}
                                        className="rounded-xl bg-white p-3 raised-sm dark:bg-zinc-800"
                                    >
                                        <Text className="mb-1 font-semibold">
                                            {product.name}
                                            <Text className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                                                {"  "}
                                                {product.brand}
                                            </Text>
                                        </Text>
                                        {product.sizes.map((item, index) => {
                                            const id = InventoryRowKey(item);
                                            const expected = item.quantityOnHand ?? 0;
                                            const counted = countFor(item);
                                            const diff =
                                                counted === null ? null : counted - expected;

                                            return (
                                                <View
                                                    key={id}
                                                    className={cx(
                                                        "flex-row flex-wrap items-center gap-2 py-2",
                                                        index > 0 &&
                                                            "border-t border-zinc-100 dark:border-zinc-700"
                                                    )}
                                                >
                                                    <View className="min-w-[112px] flex-1">
                                                        <Text className="font-medium">
                                                            {InventorySizeLabel(item)}
                                                        </Text>
                                                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                                            Expected {expected}
                                                            {diff !== null && (
                                                                <Text
                                                                    className={cx(
                                                                        "text-xs font-semibold",
                                                                        diff === 0
                                                                            ? "text-green-700 dark:text-green-400"
                                                                            : "text-amber-700 dark:text-amber-400"
                                                                    )}
                                                                >
                                                                    {"  "}
                                                                    {diff === 0
                                                                        ? "Matches"
                                                                        : `${diff > 0 ? "+" : ""}${diff}`}
                                                                </Text>
                                                            )}
                                                        </Text>
                                                    </View>
                                                    <Button
                                                        text="Matches"
                                                        icon="fa-solid fa-check"
                                                        onClick={() =>
                                                            setCount(item, String(expected))
                                                        }
                                                        className="min-h-[44px] bg-zinc-500 px-3 text-sm dark:bg-zinc-600"
                                                    />
                                                    <TextInput
                                                        value={counts[id] ?? ""}
                                                        onChangeText={(value) =>
                                                            setCount(item, value)
                                                        }
                                                        keyboardType="number-pad"
                                                        inputMode="numeric"
                                                        returnKeyType="done"
                                                        accessibilityLabel={`Counted ${product.name} ${InventorySizeLabel(item)}`}
                                                        placeholder="-"
                                                        placeholderTextColor={
                                                            isDark ? "#71717a" : "#a1a1aa"
                                                        }
                                                        selectTextOnFocus
                                                        className="min-h-[48px] w-20 rounded-xl border border-zinc-300 bg-white text-center text-xl font-bold text-zinc-900 focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                                                    />
                                                </View>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}

                    <TextField
                        label="Note (optional)"
                        value={note}
                        onChange={setNote}
                        placeholder={text.notePlaceholder}
                        maxLength={300}
                    />
                </View>
            </View>

            {confirming && (
                <ConfirmationModal
                    title={`Save the ${phase === "start" ? "start-of-event" : "end-of-event"} count`}
                    message={confirmMessage}
                    confirmText={saving ? "Saving..." : "Save count"}
                    onConfirm={() => save(() => router.back())}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </Page>
    );
};

export default InventoryCountPage;
