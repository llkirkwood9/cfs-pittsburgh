import { useNavigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import TextField from "../Components/Elements/TextField";
import { useEvents } from "@shared/Hooks/useEvents";
import { DeleteEventMessage, IsPastEvent, IsUpcomingEvent, SplitEvents } from "@shared/Lib/Events";
import { FormatRate, FormatShortDate } from "@shared/Lib/Format";
import type { Event } from "@shared/Models/Event";
import { Paths, ScreenLinks } from "../Lib/ScreenLinks";

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
    } = useEvents();
    const navigate = useNavigate();

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
                    {showsTerritory && event.territoryName && (
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
                        onClick={() => navigate(Paths.eventClose(event.id!))}
                        className="min-h-[40px] bg-green-700 px-3 text-sm hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                    />
                )}
                <Button
                    text="Sales sheets"
                    icon="fa-solid fa-print"
                    onClick={() =>
                        navigate(Paths.eventSheets(event.id!), {
                            state: { from: ScreenLinks.events.path, label: "Back to events" },
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
                    onClick={openNew}
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
                    onClose={close}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={close}
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
                        {picksTerritory && (
                            <label className="flex flex-col gap-1 sm:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Territory
                                </span>
                                <select
                                    value={form.territoryId ?? ""}
                                    onChange={(e) =>
                                        pickTerritory(
                                            e.target.value ? Number(e.target.value) : null
                                        )
                                    }
                                    className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base
                                        dark:border-zinc-600 dark:bg-zinc-800 dark:scheme-dark"
                                >
                                    <option value="">Pick a territory...</option>
                                    {territoryChoices.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                                {editing.id && form.territoryId !== editing.territoryId && (
                                    <span className="text-xs text-amber-700 dark:text-amber-400">
                                        Only an event with no orders yet can move. It is switched
                                        off when it moves; activate it again afterwards.
                                    </span>
                                )}
                            </label>
                        )}
                        <TextField
                            label="Organization"
                            value={form.organization}
                            onChange={(v) => setField("organization", v)}
                            maxLength={150}
                            placeholder="ex. School Band"
                            className="sm:col-span-2"
                        />
                        <TextField
                            label="Cart"
                            value={form.cartName}
                            onChange={(v) => setField("cartName", v)}
                            maxLength={100}
                        />
                        <TextField
                            label="Event date"
                            value={form.eventDate}
                            onChange={(v) => setField("eventDate", v)}
                            type="date"
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

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 self-end rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) => setField("isActive", e.target.checked)}
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
                    message={DeleteEventMessage(deleting, deletesForGood)}
                    confirmText={deletesForGood ? "Delete for good" : "Delete"}
                    confirmWord={deletesForGood ? "DELETE" : undefined}
                    destructive
                    onConfirm={handleDelete}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </div>
    );
};

export default EventsPage;
