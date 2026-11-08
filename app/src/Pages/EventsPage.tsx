import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Button from "../Components/Elements/Button";
import Checkbox from "../Components/Elements/Checkbox";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import DateField from "../Components/Elements/DateField";
import Grid, { Cell } from "../Components/Elements/Grid";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import Page from "../Components/Elements/Page";
import SelectField from "../Components/Elements/SelectField";
import SwipeRow from "../Components/Elements/SwipeRow";
import Text from "../Components/Elements/Text";
import TextField from "../Components/Elements/TextField";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { useEvents } from "@shared/Hooks/useEvents";
import { DeleteEventMessage, IsPastEvent, IsUpcomingEvent, SplitEvents } from "@shared/Lib/Events";
import { FormatRate, FormatShortDate } from "@shared/Lib/Format";
import { cx } from "../Lib/ClassNames";
import type { Event } from "@shared/Models/Event";
import { Paths } from "../Lib/ScreenLinks";
import { Limits } from "@shared/Lib/Limits";

/** A small rounded label beside an event's name. */
const Tag = ({ text, box, color }: { text: string; box: string; color: string }) => (
    <View className={cx("rounded-full px-2 py-0.5", box)}>
        <Text className={cx("text-xs font-semibold", color)}>{text}</Text>
    </View>
);

/**
 * Event administration. The sales tax rate, the card processing fee and the order number
 * sequence all live on the event, so each fundraiser can run with its own figures. Every event
 * belongs to a territory, and each territory has one active event at a time.
 */
const EventsPage = () => {
    const {
        events,
        loading,
        deletesForGood,
        editing,
        close,
        form,
        setField,
        open,
        openNew,
        pickTerritory,
        picksTerritory,
        showsTerritory,
        territoryChoices,
        saving,
        handleSave,
        deleting,
        setDeleting,
        handleDelete,
        load,
    } = useEvents();
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Back on this screen: read it again.
    useRefreshOnFocus(load);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    if (loading) {
        return (
            <Page edges={["left", "right"]}>
                <ListSkeleton rows={4} />
            </Page>
        );
    }

    // Active and upcoming events on top; past ones below the line. Past means not active and dated
    // before today.
    const { current, past } = SplitEvents(events);

    // Tap an event to edit it; Close out and Sales sheets stay on the row, and Delete is a swipe away.
    const renderEvent = (event: Event) => (
        <SwipeRow
            key={event.id}
            onPress={() => open(event)}
            actions={[
                {
                    label: "Delete",
                    icon: "fa-solid fa-trash",
                    tone: "danger",
                    onPress: () => setDeleting(event),
                },
            ]}
            accessibilityLabel={`${event.organization}, ${FormatShortDate(event.eventDate)}`}
            className="flex-row flex-wrap items-center gap-3 p-4"
        >
            <View className="min-w-[240px] flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="font-semibold">{event.organization}</Text>
                    {event.isActive && (
                        <Tag
                            text="Active"
                            box="bg-green-100 dark:bg-green-900/50"
                            color="text-green-800 dark:text-green-300"
                        />
                    )}
                    {IsPastEvent(event) && (
                        <Tag
                            text="Past"
                            box="bg-zinc-200 dark:bg-zinc-700"
                            color="text-zinc-600 dark:text-zinc-300"
                        />
                    )}
                    {IsUpcomingEvent(event) && (
                        <Tag
                            text="Upcoming"
                            box="bg-sky-100 dark:bg-sky-900/50"
                            color="text-sky-800 dark:text-sky-300"
                        />
                    )}
                </View>
                <View className="mt-0.5 flex-row flex-wrap gap-x-3">
                    {showsTerritory && event.territoryName && (
                        <View className="flex-row items-center gap-1">
                            <Icon
                                icon="fa-solid fa-location-dot"
                                className="text-xs text-zinc-700 dark:text-zinc-300"
                            />
                            <Text className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                {event.territoryName}
                            </Text>
                        </View>
                    )}
                    {[
                        FormatShortDate(event.eventDate),
                        event.cartName ? `Cart: ${event.cartName}` : null,
                        `Tax ${FormatRate(event.salesTaxRate)}`,
                        `Card fee ${FormatRate(event.ccProcessingFeeRate)}`,
                        `Next order #${event.nextOrderNumber}`,
                    ]
                        .filter(Boolean)
                        .map((part) => (
                            <Text key={part} className="text-xs text-zinc-500 dark:text-zinc-400">
                                {part}
                            </Text>
                        ))}
                </View>
            </View>

            <View className="ml-auto flex-row flex-wrap items-center justify-end gap-2">
                {event.isActive && (
                    <Button
                        text="Close out"
                        icon="fa-solid fa-flag-checkered"
                        onClick={() => router.push(Paths.eventClose(event.id!))}
                        className="min-h-[40px] bg-green-700 px-3 text-sm dark:bg-green-600"
                    />
                )}
                <Button
                    text="Sales sheets"
                    icon="fa-solid fa-print"
                    onClick={() => router.push(Paths.eventSheets(event.id!))}
                    className="min-h-[40px] px-3 text-sm"
                />
            </View>
        </SwipeRow>
    );

    return (
        <Page edges={["left", "right"]} onRefresh={handleRefresh} refreshing={refreshing}>
            <View className="mx-auto w-full max-w-4xl">
                <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
                    <Text className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Current & upcoming
                    </Text>
                    <Button
                        text="New event"
                        icon="fa-solid fa-plus"
                        onClick={openNew}
                        className="bg-green-700 dark:bg-green-600"
                    />
                </View>

                {current.length > 0 ? (
                    <View className="gap-2">{current.map(renderEvent)}</View>
                ) : (
                    <View className="rounded-xl border-2 border-dashed border-zinc-300 py-6 dark:border-zinc-700">
                        <Text className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                            No current or upcoming events. Tap New event to set one up.
                        </Text>
                    </View>
                )}

                {past.length > 0 && (
                    <>
                        {/* Everything below the line is over. */}
                        <View
                            className="my-6 flex-row items-center gap-3"
                            accessibilityRole="header"
                        >
                            <View className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                            <Text className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Past events
                            </Text>
                            <View className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                        </View>
                        <View className="gap-2">{past.map(renderEvent)}</View>
                    </>
                )}
            </View>

            {editing && (
                <Modal
                    title={editing.id ? "Edit event" : "New event"}
                    onClose={close}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={close}
                                className="bg-zinc-500 dark:bg-zinc-600"
                            />
                            <Button
                                text="Save"
                                icon="fa-solid fa-check"
                                onClick={handleSave}
                                loading={saving}
                            />
                        </>
                    }
                >
                    <Grid columns={{ base: 1, sm: 2 }}>
                        {picksTerritory && (
                            <Cell span={{ base: 1, sm: 2 }}>
                                <SelectField<number | null>
                                    label="Territory"
                                    value={form.territoryId}
                                    placeholder="Pick a territory..."
                                    options={territoryChoices.map((t) => ({
                                        value: t.id ?? null,
                                        label: t.name ?? "",
                                    }))}
                                    onChange={pickTerritory}
                                />
                                {editing.id != null && form.territoryId !== editing.territoryId && (
                                    <Text className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                        Only an event with no orders yet can move. It is switched
                                        off when it moves; activate it again afterwards.
                                    </Text>
                                )}
                            </Cell>
                        )}
                        <Cell span={{ base: 1, sm: 2 }}>
                            <TextField
                                label="Organization"
                                value={form.organization}
                                onChange={(v) => setField("organization", v)}
                                maxLength={Limits.eventOrganization}
                                placeholder="e.g. School Band"
                                autoCapitalize="words"
                            />
                        </Cell>
                        <TextField
                            label="Cart"
                            value={form.cartName}
                            onChange={(v) => setField("cartName", v)}
                            maxLength={Limits.eventCart}
                            autoCapitalize="words"
                        />
                        <DateField
                            label="Event date"
                            value={form.eventDate}
                            onChange={(v) => setField("eventDate", v)}
                        />
                        <TextField
                            label="Sales tax %"
                            value={form.taxPercent}
                            onChange={(v) => setField("taxPercent", v)}
                            inputMode="decimal"
                        />
                        <TextField
                            label="Card processing fee %"
                            value={form.feePercent}
                            onChange={(v) => setField("feePercent", v)}
                            inputMode="decimal"
                        />
                        <TextField
                            label="Next order number"
                            value={form.nextOrderNumber}
                            onChange={(v) => setField("nextOrderNumber", v)}
                            inputMode="numeric"
                        />
                        <View className="flex-1 justify-end">
                            <Checkbox
                                label="Active event (one per territory)"
                                checked={form.isActive}
                                onChange={(v) => setField("isActive", v)}
                            />
                        </View>
                    </Grid>
                </Modal>
            )}

            {deleting && (
                <ConfirmationModal
                    title="Delete event"
                    message={DeleteEventMessage(deleting, deletesForGood)}
                    confirmText={deletesForGood ? "Delete for good" : "Delete"}
                    confirmWord={deletesForGood ? "DELETE" : undefined}
                    destructive
                    onConfirm={handleDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </Page>
    );
};

export default EventsPage;
