import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { useAuth } from "../Context/AuthContext";
import { useSettings } from "../Context/SettingsContext";
import { useTerritory } from "../Context/TerritoryContext";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import {
    FormatRate,
    FormatShortDate,
    IsPastEvent,
    IsUpcomingEvent,
    ParseMoney,
    SplitEvents,
} from "../Lib/ModelHelpers";
import { cx } from "../Lib/ClassNames";
import { Toast } from "../Lib/Toast";
import type { Event } from "../Models/Event";
import { AddEvent, DeleteEvent, GetEvents, UpdateEvent } from "../Services/EventServices";

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
    const { user } = useAuth();
    const { settingsFor } = useSettings();
    const { territories, territoryId: territoryInView, canSwitch } = useTerritory();
    // Anyone with more than one territory chooses which an event is in.
    const companyWide = canSwitch;

    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [editing, setEditing] = useState<Event | null>(null);
    const [deleting, setDeleting] = useState<Event | null>(null);
    const isSystemAdmin = user?.role === "SystemAdmin";
    const [saving, setSaving] = useState<boolean>(false);

    const [organization, setOrganization] = useState<string>("");
    const [cartName, setCartName] = useState<string>("");
    const [eventDate, setEventDate] = useState<string>("");
    const [taxPercent, setTaxPercent] = useState<string>("7");
    const [feePercent, setFeePercent] = useState<string>("2");
    const [nextOrderNumber, setNextOrderNumber] = useState<string>("1001");
    const [isActive, setIsActive] = useState<boolean>(true);
    const [territoryId, setTerritoryId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setEvents(await GetEvents());
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Back on this screen: read it again.
    useRefreshOnFocus(load);

    if (!user) return <Redirect href="/unauthorized" />;

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const open = (event: Event) => {
        setEditing(event);
        setOrganization(event.organization ?? "");
        setCartName(event.cartName ?? "");
        // Today in the device's own time zone - toISOString would give tomorrow's date in the evening.
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        setEventDate((event.eventDate ?? today).slice(0, 10));
        setTaxPercent(String(Number(((event.salesTaxRate ?? 0.07) * 100).toFixed(4))));
        setFeePercent(String(Number(((event.ccProcessingFeeRate ?? 0.02) * 100).toFixed(4))));
        setNextOrderNumber(String(event.nextOrderNumber ?? 1001));
        setIsActive(event.isActive ?? true);
        setTerritoryId(event.territoryId ?? territoryInView ?? user?.territoryIds?.[0] ?? null);
    };

    // A new event's rates come from its territory's settings.
    const pickTerritory = async (id: number | null) => {
        setTerritoryId(id);
        if (editing?.id || id == null) return;
        const defaults = await settingsFor(id);
        setTaxPercent(String(Number((defaults.defaultSalesTaxRate * 100).toFixed(4))));
        setFeePercent(String(Number((defaults.defaultCcProcessingFeeRate * 100).toFixed(4))));
    };

    // A new event starts with the tax rate and card fee set under Settings, the most recent event's
    // cart, and order numbers carrying on from the highest used so far so no two sales sheets
    // share a number.
    const newEventDefaults = async (): Promise<Event> => {
        const latest = [...events].sort((a, b) =>
            (b.eventDate ?? "").localeCompare(a.eventDate ?? "")
        )[0];
        const nextNumber = Math.max(1001, ...events.map((e) => e.nextOrderNumber ?? 0));
        const territory = territoryInView ?? user?.territoryIds?.[0] ?? null;
        const defaults = await settingsFor(territory);
        return {
            territoryId: territory ?? undefined,
            cartName: latest?.cartName,
            salesTaxRate: defaults.defaultSalesTaxRate,
            ccProcessingFeeRate: defaults.defaultCcProcessingFeeRate,
            nextOrderNumber: nextNumber,
            isActive: true,
        };
    };

    const handleSave = async () => {
        if (!organization.trim()) return Toast.Warning("Enter the organization.");
        if (!eventDate) return Toast.Warning("Pick the event date.");

        const tax = ParseMoney(taxPercent);
        if (tax === null || tax < 0 || tax > 100)
            return Toast.Warning("The sales tax rate must be between 0 and 100 percent.");

        const fee = ParseMoney(feePercent);
        if (fee === null || fee < 0 || fee > 100)
            return Toast.Warning("The card fee must be between 0 and 100 percent.");

        if (companyWide && territoryId == null) return Toast.Warning("Pick the territory the event is in.");

        const payload: Event = {
            id: editing?.id,
            organization: organization.trim(),
            cartName: cartName.trim(),
            eventDate: new Date(`${eventDate}T00:00:00`).toISOString(),
            salesTaxRate: tax / 100,
            ccProcessingFeeRate: fee / 100,
            nextOrderNumber: Number(nextOrderNumber) || 1001,
            isActive,
            territoryId: companyWide ? (territoryId ?? undefined) : undefined,
        };

        setSaving(true);
        const saved = editing?.id ? await UpdateEvent(payload) : await AddEvent(payload);
        setSaving(false);

        if (!saved) return;

        Toast.Success(`${saved.organization} saved.`);
        setEditing(null);
        await load();
    };

    const handleDelete = async () => {
        if (!deleting?.id) return;

        const success = await DeleteEvent(deleting.id, isSystemAdmin);
        setDeleting(null);

        if (success) {
            Toast.Success("Event deleted.");
            await load();
        }
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
                    {companyWide && territoryInView == null && event.territoryName && (
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
                        onClick={() =>
                            router.push({
                                pathname: "/more/events/[eventId]/close",
                                params: { eventId: String(event.id) },
                            })
                        }
                        className="min-h-[40px] bg-green-700 px-3 text-sm dark:bg-green-600"
                    />
                )}
                <Button
                    text="Sales sheets"
                    icon="fa-solid fa-print"
                    onClick={() =>
                        router.push({
                            pathname: "/events/[eventId]/sheets",
                            params: { eventId: String(event.id) },
                        })
                    }
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
                        onClick={async () => open(await newEventDefaults())}
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
                    onClose={() => setEditing(null)}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={() => setEditing(null)}
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
                        {companyWide && (
                            <Cell span={{ base: 1, sm: 2 }}>
                                <SelectField<number | null>
                                    label="Territory"
                                    value={territoryId}
                                    placeholder="Pick a territory..."
                                    options={territories
                                        .filter((t) => t.isActive !== false || t.id === territoryId)
                                        .map((t) => ({ value: t.id ?? null, label: t.name ?? "" }))}
                                    onChange={pickTerritory}
                                />
                                {editing.id != null && territoryId !== editing.territoryId && (
                                    <Text className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                        Only an event with no orders yet can move. It is switched off
                                        when it moves; activate it again afterwards.
                                    </Text>
                                )}
                            </Cell>
                        )}
                        <Cell span={{ base: 1, sm: 2 }}>
                            <TextField
                                label="Organization"
                                value={organization}
                                onChange={setOrganization}
                                maxLength={150}
                                placeholder="e.g. School Band"
                                autoCapitalize="words"
                            />
                        </Cell>
                        <TextField
                            label="Cart"
                            value={cartName}
                            onChange={setCartName}
                            maxLength={100}
                            autoCapitalize="words"
                        />
                        <DateField label="Event date" value={eventDate} onChange={setEventDate} />
                        <TextField
                            label="Sales tax %"
                            value={taxPercent}
                            onChange={setTaxPercent}
                            inputMode="decimal"
                        />
                        <TextField
                            label="Card processing fee %"
                            value={feePercent}
                            onChange={setFeePercent}
                            inputMode="decimal"
                        />
                        <TextField
                            label="Next order number"
                            value={nextOrderNumber}
                            onChange={setNextOrderNumber}
                            inputMode="numeric"
                        />
                        <View className="flex-1 justify-end">
                            <Checkbox
                                label="Active event (one per territory)"
                                checked={isActive}
                                onChange={setIsActive}
                            />
                        </View>
                    </Grid>
                </Modal>
            )}

            {deleting && (
                <ConfirmationModal
                    title="Delete event"
                    message={
                        isSystemAdmin
                            ? `Permanently delete ${deleting.organization} and every order taken at it? The sales, their payments and their sales sheets are all removed. This cannot be undone.`
                            : `Delete ${deleting.organization}? Only an event with no orders against it can be deleted.`
                    }
                    confirmText={isSystemAdmin ? "Delete for good" : "Delete"}
                    confirmWord={isSystemAdmin ? "DELETE" : undefined}
                    destructive
                    onConfirm={handleDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </Page>
    );
};

export default EventsPage;
