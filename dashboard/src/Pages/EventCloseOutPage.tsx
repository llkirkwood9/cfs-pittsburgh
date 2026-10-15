import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import { FormatCurrency, FormatShortDate, FormatTime } from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import type { Event } from "../Models/Event";
import type { InventoryItem } from "../Models/InventoryItem";
import type { OrderSummary } from "../Models/OrderSummary";
import { GetEvent, UpdateEvent } from "../Services/EventServices";
import { GetInventory } from "../Services/InventoryServices";
import { GetOrdersForEvent } from "../Services/OrderServices";

type Step = {
    key: string;
    title: string;
    done: boolean;
    /** A step that is fine to leave, such as a layaway balance, shows as information not a warning. */
    optional?: boolean;
    summary: string;
    children?: ReactNode;
    action?: ReactNode;
};

/**
 * Closing out an event: everything worth checking before the cart packs up, in one list. Orders
 * still on the floor or waiting at checkout, balances still owed, the start and end stock counts,
 * then printing the event's sheets and closing the event so nothing more is sold under it.
 */
const EventCloseOutPage = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const id = Number(eventId);

    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [confirming, setConfirming] = useState<boolean>(false);
    const [closing, setClosing] = useState<boolean>(false);

    useEffect(() => {
        const load = async () => {
            if (!id) return setLoading(false);
            const [found, list, stock] = await Promise.all([
                GetEvent(id),
                GetOrdersForEvent(id),
                GetInventory(id),
            ]);
            setSaleEvent(found);
            setOrders(list);
            setInventory(stock);
            setLoading(false);
        };
        load();
    }, [id]);

    if (loading) {
        return (
            <div className="mx-auto max-w-3xl p-4">
                <ListSkeleton rows={5} />
            </div>
        );
    }

    if (!saleEvent) {
        return (
            <div className="p-8 text-center">
                <p className="text-base font-semibold">That event could not be found.</p>
                <Button
                    text="Back to events"
                    icon="fa-solid fa-arrow-left"
                    onClick={() => navigate("/events")}
                    className="mt-4"
                />
            </div>
        );
    }

    const drafts = orders.filter((o) => o.status === "Draft");
    const atCheckout = orders.filter((o) => o.status === "AwaitingCheckout");
    const completed = orders.filter((o) => o.status === "Completed");
    const owing = completed.filter((o) => (o.balanceDue ?? 0) > 0.004);
    const totalOwed = owing.reduce((sum, o) => sum + (o.balanceDue ?? 0), 0);
    const takings = completed.reduce((sum, o) => sum + (o.total ?? 0), 0);

    const latest = (at: (i: InventoryItem) => string | null | undefined) =>
        (inventory.map(at).filter(Boolean) as string[]).sort().pop() ?? null;
    const startAt = latest((i) => i.openingCountedAt);
    const endAt = latest((i) => i.countedAt);
    const tracks = inventory.length > 0;
    const active = Boolean(saleEvent.isActive);

    const orderList = (list: OrderSummary[], to: (o: OrderSummary) => string) => (
        <ul className="mt-2 space-y-1">
            {list.map((o) => (
                <li key={o.id}>
                    <button
                        type="button"
                        onClick={() => navigate(to(o), { state: { from: `/events/${id}/close`, label: "Back to close-out" } })}
                        className="flex w-full items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-left text-sm hover:bg-zinc-100
                            dark:bg-zinc-900/40 dark:hover:bg-zinc-700"
                    >
                        <span className="font-bold tabular-nums">#{o.orderNumber}</span>
                        <span className="min-w-0 flex-1 truncate">
                            {o.billingName || o.draftLabel || "No name yet"}
                            {o.cfsRepName && (
                                <span className="text-zinc-500 dark:text-zinc-400"> &middot; {o.cfsRepName}</span>
                            )}
                        </span>
                        <span className="tabular-nums">{FormatCurrency(o.balanceDue ?? o.total)}</span>
                        <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
                    </button>
                </li>
            ))}
        </ul>
    );

    const steps: Step[] = [
        {
            key: "floor",
            title: "Nothing left on the sales floor",
            done: drafts.length === 0,
            summary:
                drafts.length === 0
                    ? "Every order has been sent to checkout or discarded."
                    : `${drafts.length} order${drafts.length === 1 ? " is" : "s are"} still being written up. Send ${
                          drafts.length === 1 ? "it" : "them"
                      } to checkout, or discard ${drafts.length === 1 ? "it" : "them"} on the Sell screen.`,
            children: drafts.length > 0 && orderList(drafts, (o) => `/receipt/${o.id}`),
        },
        {
            key: "checkout",
            title: "Nobody waiting at checkout",
            done: atCheckout.length === 0,
            summary:
                atCheckout.length === 0
                    ? "Every order that reached checkout has been completed or voided."
                    : `${atCheckout.length} order${atCheckout.length === 1 ? " is" : "s are"} waiting to be paid.`,
            children: atCheckout.length > 0 && orderList(atCheckout, (o) => `/checkout/${o.id}`),
        },
        {
            key: "balances",
            title: "Balances still owed",
            done: owing.length === 0,
            optional: true,
            summary:
                owing.length === 0
                    ? "Every completed sale is paid in full."
                    : `${owing.length} completed sale${owing.length === 1 ? "" : "s"} still owe${
                          owing.length === 1 ? "s" : ""
                      } ${FormatCurrency(totalOwed)} - normal for layaway and financing.`,
            children: owing.length > 0 && orderList(owing, (o) => `/receipt/${o.id}`),
        },
        ...(tracks
            ? [
                  {
                      key: "start",
                      title: "Start-of-event count",
                      done: Boolean(startAt),
                      optional: true,
                      summary: startAt
                          ? `Taken at ${FormatTime(startAt)}.`
                          : "Not taken. The inventory sheet will have no starting figures.",
                  },
                  {
                      key: "end",
                      title: "End-of-event count",
                      done: Boolean(endAt),
                      summary: endAt
                          ? `Taken at ${FormatTime(endAt)}.`
                          : active
                            ? "Count what's left on the shelf before the event is closed."
                            : "Not taken. Counts can only be taken while the event is active.",
                      action:
                          active && (
                              <Button
                                  text={endAt ? "Recount" : "Count now"}
                                  icon="fa-solid fa-clipboard-check"
                                  onClick={() => navigate("/inventory/count/end")}
                                  className="min-h-[40px] px-3 text-sm"
                              />
                          ),
                  },
              ]
            : []),
    ];

    const blocking = steps.filter((s) => !s.done && !s.optional);

    const closeEvent = async () => {
        setClosing(true);
        const saved = await UpdateEvent({ id: saleEvent.id, isActive: false });
        setClosing(false);
        setConfirming(false);
        if (!saved) return;
        Toast.Success(`${saleEvent.organization} is closed.`);
        navigate("/events");
    };

    return (
        <div className="mx-auto max-w-3xl p-3 sm:p-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">Close out {saleEvent.organization}</h1>
                <Button
                    text="Back to events"
                    icon="fa-solid fa-arrow-left"
                    onClick={() => navigate("/events")}
                    className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                />
            </div>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                {FormatShortDate(saleEvent.eventDate)} &middot; {completed.length} completed sale
                {completed.length === 1 ? "" : "s"} &middot; {FormatCurrency(takings)}
                {!active && " · This event is already closed."}
            </p>

            <ol className="space-y-3">
                {steps.map((step) => (
                    <li key={step.key} className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
                        <div className="flex flex-wrap items-start gap-3">
                            {/* Status is an icon plus the wording, never color alone. */}
                            <Icon
                                icon={
                                    step.done
                                        ? "fa-solid fa-circle-check"
                                        : step.optional
                                          ? "fa-solid fa-circle-info"
                                          : "fa-solid fa-triangle-exclamation"
                                }
                                className={`mt-0.5 text-lg ${
                                    step.done
                                        ? "text-green-700 dark:text-green-400"
                                        : step.optional
                                          ? "text-sky-700 dark:text-sky-400"
                                          : "text-amber-700 dark:text-amber-400"
                                }`}
                            />
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                    {step.title}
                                    <span className="ml-2 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                                        {step.done ? "Done" : step.optional ? "Check" : "To do"}
                                    </span>
                                </p>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.summary}</p>
                                {step.children}
                            </div>
                            {step.action}
                        </div>
                    </li>
                ))}

                <li className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
                    <div className="flex flex-wrap items-center gap-3">
                        <Icon icon="fa-solid fa-print" className="text-lg text-zinc-500" />
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold">Print the event&apos;s sheets</p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">Stat sheet, sales sheets and inventory sheet.</p>
                        </div>
                        <Button
                            text="Sales sheets"
                            icon="fa-solid fa-print"
                            onClick={() =>
                                navigate(`/events/${id}/sheets`, {
                                    state: { from: `/events/${id}/close`, label: "Back to close-out" },
                                })
                            }
                            className="min-h-[40px] px-3 text-sm"
                        />
                    </div>
                </li>
            </ol>

            {active && (
                <div className="mt-5 rounded-xl border-2 border-zinc-200 p-4 dark:border-zinc-700">
                    <p className="font-semibold">Close the event</p>
                    <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">No new orders can be taken once it&apos;s closed.</p>
                    <Button
                        text={blocking.length ? "Close anyway" : "Close event"}
                        icon="fa-solid fa-flag-checkered"
                        onClick={() => setConfirming(true)}
                        className={
                            blocking.length
                                ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
                                : "bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                        }
                    />
                </div>
            )}

            {confirming && (
                <ConfirmationModal
                    title={`Close ${saleEvent.organization}`}
                    message={
                        blocking.length
                            ? `There ${blocking.length === 1 ? "is" : "are"} still ${blocking.length} thing${
                                  blocking.length === 1 ? "" : "s"
                              } to do: ${blocking.map((b) => b.title.toLowerCase()).join("; ")}. Close the event anyway? Open orders stay open and can still be finished.`
                            : `Close ${saleEvent.organization}? No new orders can be taken under it once it's closed.`
                    }
                    confirmText={closing ? "Closing..." : "Close event"}
                    onConfirm={closeEvent}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </div>
    );
};

export default EventCloseOutPage;
