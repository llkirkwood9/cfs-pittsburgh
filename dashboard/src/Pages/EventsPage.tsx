import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import TextField from "../Components/Elements/TextField";
import { useAuth } from "../Context/AuthContext";
import { FormatRate, FormatShortDate, ParseMoney } from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import type { Event } from "../Models/Event";
import { AddEvent, DeleteEvent, GetEvents, UpdateEvent } from "../Services/EventServices";

/**
 * Event administration. The sales tax rate, the card processing fee and the order number
 * sequence all live on the event, so each fundraiser can run with its own figures.
 */
const EventsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [editing, setEditing] = useState<Event | null>(null);
    const [deleting, setDeleting] = useState<Event | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    const [organization, setOrganization] = useState<string>("");
    const [cartName, setCartName] = useState<string>("");
    const [eventDate, setEventDate] = useState<string>("");
    const [taxPercent, setTaxPercent] = useState<string>("7");
    const [feePercent, setFeePercent] = useState<string>("0");
    const [nextOrderNumber, setNextOrderNumber] = useState<string>("1001");
    const [isActive, setIsActive] = useState<boolean>(true);

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
        setEventDate((event.eventDate ?? new Date().toISOString()).slice(0, 10));
        setTaxPercent(String(Number(((event.salesTaxRate ?? 0.07) * 100).toFixed(4))));
        setFeePercent(String(Number(((event.ccProcessingFeeRate ?? 0) * 100).toFixed(4))));
        setNextOrderNumber(String(event.nextOrderNumber ?? 1001));
        setIsActive(event.isActive ?? true);
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

        const payload: Event = {
            id: editing?.id,
            organization: organization.trim(),
            cartName: cartName.trim(),
            eventDate: new Date(`${eventDate}T00:00:00`).toISOString(),
            salesTaxRate: tax / 100,
            ccProcessingFeeRate: fee / 100,
            nextOrderNumber: Number(nextOrderNumber) || 1001,
            isActive,
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

        const success = await DeleteEvent(deleting.id);
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

    return (
        <div className="mx-auto max-w-4xl p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">Events</h1>
                <Button
                    text="New event"
                    icon="fa-solid fa-plus"
                    onClick={() =>
                        open({
                            eventDate: new Date().toISOString(),
                            salesTaxRate: 0.07,
                            ccProcessingFeeRate: 0,
                            nextOrderNumber: 1001,
                            isActive: true,
                        })
                    }
                    className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                />
            </div>

            <ul className="space-y-2">
                {events.map((event) => (
                    <li
                        key={event.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800"
                    >
                        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                            <p className="font-semibold">
                                {event.organization}
                                {event.isActive && (
                                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                        Active
                                    </span>
                                )}
                            </p>
                            <p className="flex flex-wrap gap-x-3 text-xs text-zinc-500 dark:text-zinc-400">
                                <span>{FormatShortDate(event.eventDate)}</span>
                                {event.cartName && <span>Cart: {event.cartName}</span>}
                                <span>Tax {FormatRate(event.salesTaxRate)}</span>
                                <span>Card fee {FormatRate(event.ccProcessingFeeRate)}</span>
                                <span>Next order #{event.nextOrderNumber}</span>
                            </p>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
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
                ))}
            </ul>

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
                        <TextField
                            label="Organization"
                            value={organization}
                            onChange={setOrganization}
                            maxLength={150}
                            placeholder="e.g. Hampton Band"
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
                            <span className="text-sm font-medium">Active event</span>
                        </label>
                    </div>

                    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                        Changing the tax rate only affects orders taken from now on. Every order
                        stores the rate it was written under, so past receipts never change.
                    </p>
                </Modal>
            )}

            {deleting && (
                <ConfirmationModal
                    title="Delete event"
                    message={`Delete ${deleting.organization}? Only an event with no orders against it can be deleted.`}
                    confirmText="Delete"
                    destructive
                    onConfirm={handleDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </div>
    );
};

export default EventsPage;
