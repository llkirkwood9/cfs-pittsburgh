import { Pressable, View } from "react-native";
import Icon from "../Elements/Icon";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
import { FormatCurrency, FormatShortDate, IsPastEvent, IsUpcomingEvent } from "../../Lib/ModelHelpers";
import type { EventTally } from "../../Models/DashboardStats";
import type { Event } from "../../Models/Event";

type Props = {
    events: EventTally[];
    /** Opens one event's own figures. */
    onSelect: (eventId: number) => void;
};

/** The parts of an event the Past and upcoming checks read. */
const AsEvent = (tally: EventTally): Event => ({
    isActive: tally.isActive,
    eventDate: tally.eventDate ?? undefined,
});

/**
 * Every event side by side, for the overview: what each one sold, with a bar for its total sales
 * so the best fundraisers stand out. Tapping one opens its own figures. Events that haven't
 * happened yet are left out, since they have no sales.
 */
const EventBreakdown = ({ events, onSelect }: Props) => {
    const shown = events.filter((e) => !IsUpcomingEvent(AsEvent(e)));
    const best = Math.max(0, ...shown.map((e) => e.totalSales ?? 0));

    return (
        <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
            <Text className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Events
            </Text>
            {shown.length === 0 ? (
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">No events yet.</Text>
            ) : (
                shown.map((event, index) => {
                    const total = event.totalSales ?? 0;
                    const past = IsPastEvent(AsEvent(event));
                    return (
                        <Pressable
                            key={event.eventId}
                            onPress={() => event.eventId && onSelect(event.eventId)}
                            accessibilityRole="button"
                            accessibilityLabel={`${event.organization}, ${FormatCurrency(total)}`}
                            className={cx(
                                "flex-row flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-2 py-3 active:bg-zinc-50 dark:active:bg-zinc-700/40",
                                index > 0 && "border-t border-zinc-100 dark:border-zinc-700"
                            )}
                        >
                            <View className="min-w-[192px] flex-1">
                                <View className="flex-row flex-wrap items-center gap-2">
                                    <Text className="font-semibold">{event.organization}</Text>
                                    {event.isActive && (
                                        <View className="rounded-full bg-green-100 px-2 py-0.5 dark:bg-green-900/50">
                                            <Text className="text-xs font-semibold text-green-800 dark:text-green-300">
                                                Active
                                            </Text>
                                        </View>
                                    )}
                                    {past && (
                                        <View className="rounded-full bg-zinc-200 px-2 py-0.5 dark:bg-zinc-700">
                                            <Text className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                                Past
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {FormatShortDate(event.eventDate)} · {event.completedOrderCount ?? 0} sale
                                    {event.completedOrderCount === 1 ? "" : "s"} ·{" "}
                                    {event.mattressAndBaseCount ?? 0} matts/bases · average{" "}
                                    {FormatCurrency(event.averageSale)}
                                </Text>
                                {/* Total sales against the best event's. */}
                                <View className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                                    <View
                                        className="h-full rounded-full bg-sky-600 dark:bg-sky-500"
                                        style={{ width: `${best > 0 ? (total / best) * 100 : 0}%` }}
                                    />
                                </View>
                            </View>
                            <View className="ml-auto w-28 items-end">
                                <Text className="font-bold tabular-nums">{FormatCurrency(total)}</Text>
                                <Text className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                                    Net {FormatCurrency(event.netSales)}
                                </Text>
                            </View>
                            <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
                        </Pressable>
                    );
                })
            )}
        </View>
    );
};

export default EventBreakdown;
