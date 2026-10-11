import { Pressable, ScrollView, View } from "react-native";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
import { FormatCurrency } from "../../Lib/ModelHelpers";
import type { OrderSummary } from "../../Models/OrderSummary";

type Props = {
    drafts: OrderSummary[];
    activeId: number | null;
    onSelect: (id: number) => void;
    onNew: () => void;
    creating?: boolean;
};

/**
 * Horizontal switcher across the rep's open drafts. This is what makes several customers at once
 * workable: each customer is a tab, and switching never loses anything because every change is
 * already saved server-side.
 */
const DraftTabs = ({ drafts, activeId, onSelect, onNew, creating = false }: Props) => {
    return (
        <View className="flex-row items-center gap-2">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-1"
                contentContainerClassName="gap-2 pb-1"
            >
                {drafts.map((draft) => {
                    const active = draft.id === activeId;
                    const label = draft.draftLabel || draft.billingName || `#${draft.orderNumber}`;
                    const color = active ? "text-white" : "text-zinc-800 dark:text-zinc-100";

                    return (
                        <Pressable
                            key={draft.id}
                            onPress={() => draft.id && onSelect(draft.id)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            className={cx(
                                "min-h-[56px] shrink-0 justify-center rounded-xl px-4",
                                active
                                    ? "bg-sky-700 dark:bg-sky-600"
                                    : "bg-white active:bg-zinc-200 dark:bg-zinc-800 dark:active:bg-zinc-700"
                            )}
                        >
                            <Text className={cx("max-w-[160px] text-sm font-semibold", color)} numberOfLines={1}>
                                {label}
                            </Text>
                            <Text className={cx("text-xs opacity-80", color)}>
                                #{draft.orderNumber} · {draft.lineCount ?? 0} item
                                {(draft.lineCount ?? 0) === 1 ? "" : "s"} · {FormatCurrency(draft.total)}
                            </Text>
                        </Pressable>
                    );
                })}

                {drafts.length === 0 && (
                    <View className="min-h-[56px] flex-row items-center gap-2">
                        <Icon icon="fa-solid fa-arrow-right" className="text-sm text-zinc-500 dark:text-zinc-400" />
                        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                            Start an order to begin
                        </Text>
                    </View>
                )}
            </ScrollView>

            <Button
                text="New"
                icon="fa-solid fa-plus"
                onClick={onNew}
                loading={creating}
                className="shrink-0 bg-green-700 dark:bg-green-600"
            />
        </View>
    );
};

export default DraftTabs;
