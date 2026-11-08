import { useNavigate, useParams } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import { useCloseOut } from "@shared/Hooks/useCloseOut";
import { CloseEventMessage } from "@shared/Lib/CloseOut";
import type { CloseOutStep } from "@shared/Lib/CloseOut";
import { FormatCurrency, FormatShortDate } from "@shared/Lib/Format";
import type { OrderSummary } from "@shared/Models/OrderSummary";
import { Paths, ScreenLinks } from "../Lib/ScreenLinks";

/**
 * Closing out an event: everything worth checking before the cart packs up, in one list. Orders
 * still on the floor or waiting at checkout, balances still owed, the start and end stock counts,
 * then printing the event's sheets and closing the event so nothing more is sold under it.
 */
const EventCloseOutPage = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const id = Number(eventId);
    const {
        saleEvent,
        loading,
        canClear,
        active,
        summary,
        steps,
        blocking,
        confirming,
        setConfirming,
        closing,
        closeEvent,
        clearing,
        setClearing,
        askOne,
        askAll,
        working,
        clearOrders,
    } = useCloseOut(id);

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
                    onClick={() => navigate(ScreenLinks.events.path)}
                    className="mt-4"
                />
            </div>
        );
    }

    const { completed, takings, endAt } = summary;

    // The dialog stays open, showing it's working, until every order is done.
    const clear = async () => {
        if (!clearing) return;
        await clearOrders(clearing.orders);
        setClearing(null);
    };

    const clearButton = (o: OrderSummary) => (
        <Button
            text={o.voidsWhenCleared ? "Void" : "Discard"}
            icon={o.voidsWhenCleared ? "fa-solid fa-ban" : "fa-solid fa-trash"}
            onClick={() => askOne(o)}
            className="min-h-[40px] shrink-0 bg-red-700 px-3 text-sm hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
        />
    );

    const orderList = (step: CloseOutStep, list: OrderSummary[]) => (
        <ul className="mt-2 space-y-1">
            {list.map((o) => (
                <li key={o.id} className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                step.key === "checkout"
                                    ? Paths.checkoutOrder(o.id!)
                                    : Paths.receipt(o.id!),
                                {
                                    state: {
                                        from: Paths.eventClose(id),
                                        label: "Back to close-out",
                                    },
                                }
                            )
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-left text-sm hover:bg-zinc-100
                            dark:bg-zinc-900/40 dark:hover:bg-zinc-700"
                    >
                        <span className="font-bold tabular-nums">#{o.orderNumber}</span>
                        <span className="min-w-0 flex-1 truncate">
                            {o.billingName || o.draftLabel || "No name yet"}
                            {o.cfsRepName && (
                                <span className="text-zinc-500 dark:text-zinc-400">
                                    {" "}
                                    &middot; {o.cfsRepName}
                                </span>
                            )}
                        </span>
                        <span className="tabular-nums">
                            {FormatCurrency(o.balanceDue ?? o.total)}
                        </span>
                        <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
                    </button>
                    {step.clearable && canClear && clearButton(o)}
                </li>
            ))}
        </ul>
    );

    const stepAction = (step: CloseOutStep) => {
        if (step.clearAll && canClear && (step.orders?.length ?? 0) > 1) {
            const { what, text } = step.clearAll;
            return (
                <Button
                    text={text}
                    icon={text === "Void all" ? "fa-solid fa-ban" : "fa-solid fa-broom"}
                    onClick={() => askAll(step.orders ?? [], what)}
                    className="min-h-[40px] bg-red-700 px-3 text-sm hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
                />
            );
        }
        if (step.key === "end" && active) {
            return (
                <Button
                    text={endAt ? "Recount" : "Count now"}
                    icon="fa-solid fa-clipboard-check"
                    onClick={() => navigate(Paths.inventoryCount("end"))}
                    className="min-h-[40px] px-3 text-sm"
                />
            );
        }
        return null;
    };

    return (
        <div className="mx-auto max-w-3xl p-3 sm:p-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">Close out {saleEvent.organization}</h1>
                <Button
                    text="Back to events"
                    icon="fa-solid fa-arrow-left"
                    onClick={() => navigate(ScreenLinks.events.path)}
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
                    <li
                        key={step.key}
                        className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800"
                    >
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
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    {step.summary}
                                </p>
                                {step.orders?.length ? orderList(step, step.orders) : null}
                            </div>
                            {stepAction(step)}
                        </div>
                    </li>
                ))}

                <li className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
                    <div className="flex flex-wrap items-center gap-3">
                        <Icon icon="fa-solid fa-print" className="text-lg text-zinc-500" />
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold">Print the event&apos;s sheets</p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                Stat sheet, sales sheets and inventory sheet.
                            </p>
                        </div>
                        <Button
                            text="Sales sheets"
                            icon="fa-solid fa-print"
                            onClick={() =>
                                navigate(Paths.eventSheets(id), {
                                    state: {
                                        from: Paths.eventClose(id),
                                        label: "Back to close-out",
                                    },
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
                    <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                        No new orders can be taken once it&apos;s closed.
                    </p>
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
                    message={CloseEventMessage(saleEvent.organization, blocking)}
                    confirmText={closing ? "Closing..." : "Close event"}
                    onConfirm={() => closeEvent(() => navigate(ScreenLinks.events.path))}
                    onCancel={() => setConfirming(false)}
                />
            )}

            {clearing && (
                <ConfirmationModal
                    title={clearing.title}
                    message={clearing.message}
                    confirmText={working ? "Working..." : clearing.confirmText}
                    destructive
                    onConfirm={clear}
                    onCancel={() => !working && setClearing(null)}
                />
            )}
        </div>
    );
};

export default EventCloseOutPage;
