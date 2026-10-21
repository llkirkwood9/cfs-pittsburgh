import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import TextField from "../Components/Elements/TextField";
import { useAuth } from "../Context/AuthContext";
import { useSettings } from "../Context/SettingsContext";
import { useTerritory } from "../Context/TerritoryContext";
import {
    FormatRate,
    FormatShortDate,
    IsPastEvent,
    IsUpcomingEvent,
    ParseMoney,
    SplitEvents,
} from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import type { Event } from "../Models/Event";
import { AddEvent, DeleteEvent, GetEvents, UpdateEvent } from "../Services/EventServices";

/**
 * Event administration. The sales tax rate, the card processing fee and the order number
 * sequence all live on the event, so each fundraiser can run with its own figures. Every event
 * belongs to a territory, and each territory has one active event at a time.
 */
const EventsPage = () => {
    const { user } = useAuth();
    const { settingsFor } = useSettings();
    const { territories, territoryId: territoryInView, canSwitch } = useTerritory();
    const navigate = useNavigate();
    // Anyone with more than one territory chooses which an event is in.
    const companyWide = canSwitch;

    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
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

    const load = async () => {
        setLoading(true);
        setEvents(await GetEvents());
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    if (!user) return <Navigate to="/unauthorized" replace />;

    const open = (event: Event) => {
        setEditing(event);
        setOrganization(event.organization ?? "");
        setCartName(event.cartName ?? "");
        // Today in the viewer's own time zone - toISOString would give tomorrow's date in the evening.
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

        if (companyWide && territoryId == null)
            return Toast.Warning("Pick the territory the event is in.");

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
            <div className="mx-auto max-w-4xl p-4">
                <ListSkeleton rows={4} />
            </div>
        );
    }

    // Active and upcoming events on top; past ones below the line. Past means not active and dated
    // before today.
    const { current, past } = SplitEvents(events);

    const renderEvent = (event: Event) => (
        <li
            key={event.id}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800"
        >
            <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <p className="font-semibold">
                    {event.organization}
                    {event.isActive && (
                        <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-300">
                            Active
                        </span>
                    )}
                    {IsPastEvent(event) && (
                        <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                            Past
                        </span>
                    )}
                    {IsUpcomingEvent(event) && (
                        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                            Upcoming
                        </span>
                    )}
                </p>
                <p className="flex flex-wrap gap-x-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {companyWide && territoryInView == null && event.territoryName && (
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                            <Icon icon="fa-solid fa-location-dot" className="mr-1" />
                            {event.territoryName}
                        </span>
                    )}
                    <span>{FormatShortDate(event.eventDate)}</span>
                    {event.cartName && <span>Cart: {event.cartName}</span>}
                    <span>Tax {FormatRate(event.salesTaxRate)}</span>
                    <span>Card fee {FormatRate(event.ccProcessingFeeRate)}</span>
                    <span>Next order #{event.nextOrderNumber}</span>
                </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {event.isActive && (
                    <Button
                        text="Close out"
                        icon="fa-solid fa-flag-checkered"
                        onClick={() => navigate(`/events/${event.id}/close`)}
                        className="min-h-[40px] bg-green-700 px-3 text-sm hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                    />
                )}
                <Button
                    text="Sales sheets"
                    icon="fa-solid fa-print"
                    onClick={() =>
                        navigate(`/events/${event.id}/sheets`, {
                            state: { from: "/events", label: "Back to events" },
                        })
                    }
                    className="min-h-[40px] px-3 text-sm"
                />
                <Button
                    text="Edit"
                    icon="fa-solid fa-pen"
                    onClick={() => open(event)}
                    className="min-h-[40px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                />
                <button
                    type="button"
                    onClick={() => setDeleting(event)}
                    aria-label="Delete event"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700
                    hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                    <Icon icon="fa-solid fa-trash" />
                </button>
            </div>
        </li>
    );

    return (
        <div className="mx-auto max-w-4xl p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">Events</h1>
                <Button
                    text="New event"
                    icon="fa-solid fa-plus"
                    onClick={async () => open(await newEventDefaults())}
                    className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                />
            </div>

            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Current &amp; upcoming
            </h2>
            {current.length > 0 ? (
                <ul className="space-y-2">{current.map(renderEvent)}</ul>
            ) : (
                <p className="rounded-xl border-2 border-dashed border-zinc-300 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    No current or upcoming events. Tap New event to set one up.
                </p>
            )}

            {past.length > 0 && (
                <>
                    {/* Everything below the line is over. */}
                    <div className="my-6 flex items-center gap-3" role="separator">
                        <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                        <span className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Past events
                        </span>
                        <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                    </div>
                    <ul className="space-y-2">{past.map(renderEvent)}</ul>
                </>
            )}

            {editing && (
                <Modal
                    title={editing.id ? "Edit event" : "New event"}
                    onClose={() => setEditing(null)}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={() => setEditing(null)}
                                className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {companyWide && (
                            <label className="flex flex-col gap-1 sm:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Territory
                                </span>
                                <select
                                    value={territoryId ?? ""}
                                    onChange={(e) =>
                                        pickTerritory(
                                            e.target.value ? Number(e.target.value) : null
                                        )
                                    }
                                    className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base
                                        dark:border-zinc-600 dark:bg-zinc-800 dark:scheme-dark"
                                >
                                    <option value="">Pick a territory...</option>
                                    {territories
                                        .filter((t) => t.isActive !== false || t.id === territoryId)
                                        .map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                </select>
                                {editing.id && territoryId !== editing.territoryId && (
                                    <span className="text-xs text-amber-700 dark:text-amber-400">
                                        Only an event with no orders yet can move. It is switched
                                        off when it moves; activate it again afterwards.
                                    </span>
                                )}
                            </label>
                        )}
                        <TextField
                            label="Organization"
                            value={organization}
                            onChange={setOrganization}
                            maxLength={150}
                            placeholder="ex. School Band"
                            className="sm:col-span-2"
                        />
                        <TextField
                            label="Cart"
                            value={cartName}
                            onChange={setCartName}
                            maxLength={100}
                        />
                        <TextField
                            label="Event date"
                            value={eventDate}
                            onChange={setEventDate}
                            type="date"
                        />
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

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 self-end rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm font-medium">
                                Active event{" "}
                                <span className="font-normal text-zinc-500 dark:text-zinc-400">
                                    (one per territory)
                                </span>
                            </span>
                        </label>
                    </div>

                    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                        Rate changes only apply to new orders.
                    </p>
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
        </div>
    );
};

export default EventsPage;
