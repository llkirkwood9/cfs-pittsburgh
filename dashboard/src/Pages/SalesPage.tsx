import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import TabButton from "../Components/Elements/TabButton";
import AddItemModal from "../Components/Sales/AddItemModal";
import AddServiceModal from "../Components/Sales/AddServiceModal";
import CustomerDetailsSheet from "../Components/Sales/CustomerDetailsSheet";
import CustomerForm from "../Components/Sales/CustomerForm";
import DraftTabs from "../Components/Sales/DraftTabs";
import EditLineModal from "../Components/Sales/EditLineModal";
import UpchargeModal from "../Components/Sales/UpchargeModal";
import OrderLineList from "../Components/Sales/OrderLineList";
import OrderTotals from "../Components/Sales/OrderTotals";
import { useAuth } from "../Context/AuthContext";
import { FormatCurrency } from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { Event } from "../Models/Event";
import type { Order } from "../Models/Order";
import type { OrderLine } from "../Models/OrderLine";
import type { OrderSummary } from "../Models/OrderSummary";
import type { Product } from "../Models/Product";
import { GetDeliveryOptions } from "../Services/DeliveryOptionServices";
import { GetActiveEvent } from "../Services/EventServices";
import {
    AddOrder,
    AddOrderLine,
    DeleteOrder,
    DeleteOrderLine,
    GetDrafts,
    GetOrder,
    SubmitOrder,
    UpdateOrder,
    UpdateOrderLine,
} from "../Services/OrderServices";
import { GetProducts } from "../Services/ProductServices";
import { GetReps } from "../Services/UserServices";

/**
 * The sales floor. A rep keeps as many drafts open as they have customers, builds each one from
 * the catalog, then hands it to the checkout table with one button.
 */
const SalesPage = () => {
    const { user } = useAuth();

    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [reps, setReps] = useState<string[]>([]);

    const [drafts, setDrafts] = useState<OrderSummary[]>([]);
    const [order, setOrder] = useState<Order | null>(null);

    const [loading, setLoading] = useState<boolean>(true);
    const [creating, setCreating] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [pane, setPane] = useState<"items" | "customer">("items");

    const [showAddItem, setShowAddItem] = useState<boolean>(false);
    const [editingLine, setEditingLine] = useState<OrderLine | null>(null);
    const [servicingLine, setServicingLine] = useState<OrderLine | null>(null);
    const [upchargingLine, setUpchargingLine] = useState<OrderLine | null>(null);
    const [removingLine, setRemovingLine] = useState<OrderLine | null>(null);
    const [discardingDraft, setDiscardingDraft] = useState<boolean>(false);
    const [showCustomerSheet, setShowCustomerSheet] = useState<boolean>(false);

    // Bumped only when the customer sheet writes back, which remounts the rep's form so it picks
    // up what the customer typed. Keying on updatedAt instead would remount on every blur-save
    // and pull focus out of the field the rep just moved into.
    const [formVersion, setFormVersion] = useState<number>(0);

    const refreshDrafts = useCallback(async (eventId: number) => {
        const list = await GetDrafts(eventId);
        setDrafts(list);
        return list;
    }, []);

    useEffect(() => {
        const load = async () => {
            setLoading(true);

            const active = await GetActiveEvent();
            setSaleEvent(active);

            if (!active?.id) {
                setLoading(false);
                return;
            }

            const [catalog, options, repNames, draftList] = await Promise.all([
                GetProducts(),
                GetDeliveryOptions(),
                GetReps(),
                GetDrafts(active.id),
            ]);

            setProducts(catalog);
            setDeliveryOptions(options);
            setReps(repNames);
            setDrafts(draftList);

            if (draftList.length > 0 && draftList[0].id) {
                const first = await GetOrder(draftList[0].id);
                setOrder(first);
            }

            setLoading(false);
        };

        load();
    }, []);

    if (!user) return <Navigate to="/unauthorized" replace />;

    const handleNewDraft = async () => {
        if (!saleEvent?.id) return;

        setCreating(true);
        const created = await AddOrder(saleEvent.id);
        setCreating(false);

        if (!created) return;

        setOrder(created);
        setPane("customer");
        await refreshDrafts(saleEvent.id);
        Toast.Success(`Order #${created.orderNumber} started.`);
    };

    const handleSelectDraft = async (id: number) => {
        const selected = await GetOrder(id);
        if (selected) setOrder(selected);
    };

    /** Every mutation returns the recalculated order, so state and totals stay in lockstep. */
    const applyResult = async (result: Order | null) => {
        if (!result) return;
        setOrder(result);
        if (saleEvent?.id) await refreshDrafts(saleEvent.id);
    };

    const handleSaveOrder = async (changes: Order) => {
        await applyResult(await UpdateOrder(changes));
    };

    const handleAddLine = async (line: OrderLine) => {
        if (!order?.id) return;
        await applyResult(await AddOrderLine(order.id, line));
    };

    const handleUpdateLine = async (line: OrderLine) => {
        await applyResult(await UpdateOrderLine(line));
    };

    const handleRemoveLine = async () => {
        if (!removingLine?.id) return;
        const result = await DeleteOrderLine(removingLine.id);
        setRemovingLine(null);
        await applyResult(result);
    };

    const handleDiscardDraft = async () => {
        if (!order?.id || !saleEvent?.id) return;

        const success = await DeleteOrder(order.id);
        setDiscardingDraft(false);

        if (!success) return;

        const remaining = await refreshDrafts(saleEvent.id);
        setOrder(remaining[0]?.id ? await GetOrder(remaining[0].id) : null);
        Toast.Success("Draft discarded.");
    };

    const handleSendToCheckout = async () => {
        if (!order?.id || !saleEvent?.id) return;

        setSubmitting(true);
        const result = await SubmitOrder(order.id);
        setSubmitting(false);

        if (!result) return;

        Toast.Success(`Order #${result.orderNumber} is with checkout. Send the customer over.`);

        const remaining = await refreshDrafts(saleEvent.id);
        setOrder(remaining[0]?.id ? await GetOrder(remaining[0].id) : null);
    };

    // Stock moves as other orders complete, so the picker always opens on fresh counts.
    const openAddItem = () => {
        setShowAddItem(true);
        GetProducts().then((catalog) => {
            if (catalog.length) setProducts(catalog);
        });
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-screen-2xl p-4">
                <ListSkeleton rows={6} />
            </div>
        );
    }

    if (!saleEvent) {
        return (
            <div className="mx-auto max-w-lg p-6 text-center">
                <Icon icon="fa-solid fa-calendar-xmark" className="text-3xl text-zinc-400" />
                <h1 className="mt-3 text-xl font-bold">No active event</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    New orders can only be taken while an event is active. A manager can activate
                    one under Events.
                </p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-screen-2xl p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="text-xl font-bold">{saleEvent.organization}</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {drafts.length} open order{drafts.length === 1 ? "" : "s"}
                </p>
            </div>

            <DraftTabs
                drafts={drafts}
                activeId={order?.id ?? null}
                onSelect={handleSelectDraft}
                onNew={handleNewDraft}
                creating={creating}
            />

            {!order ? (
                <div className="mt-6 rounded-xl border-2 border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
                    <Icon icon="fa-solid fa-user-plus" className="text-3xl text-zinc-400" />
                    <p className="mt-3 text-base font-semibold">No order open</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Tap New to start one for the customer in front of you.
                    </p>
                </div>
            ) : (
                <>
                    <div className="mt-4 flex gap-2 lg:hidden">
                        <TabButton
                            text="Items"
                            active={pane === "items"}
                            onClick={() => setPane("items")}
                            badge={order.lines?.length ?? 0}
                            className="flex-1 justify-center"
                        />
                        <TabButton
                            text="Customer"
                            active={pane === "customer"}
                            onClick={() => setPane("customer")}
                            className="flex-1 justify-center"
                        />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
                        <section
                            className={`lg:col-span-3 ${pane === "items" ? "" : "hidden lg:block"}`}
                        >
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <h2 className="text-base font-bold">
                                    Items
                                    <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                                        Order #{order.orderNumber}
                                    </span>
                                </h2>
                                <Button
                                    text="Add item"
                                    icon="fa-solid fa-plus"
                                    onClick={openAddItem}
                                    className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                                />
                            </div>

                            <OrderLineList
                                lines={order.lines ?? []}
                                onEdit={setEditingLine}
                                onAddService={setServicingLine}
                                onAddUpcharge={setUpchargingLine}
                                onRemove={setRemovingLine}
                                onQuantity={(line, quantity) =>
                                    handleUpdateLine({ id: line.id, quantity })
                                }
                            />
                        </section>

                        <section
                            className={`lg:col-span-2 ${pane === "customer" ? "" : "hidden lg:block"}`}
                        >
                            <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                                <Button
                                    text="Hand tablet to customer"
                                    icon="fa-solid fa-hand-holding-heart"
                                    onClick={() => setShowCustomerSheet(true)}
                                    className="mb-4 w-full"
                                />
                                <CustomerForm
                                    key={`${order.id}-${formVersion}`}
                                    order={order}
                                    reps={reps}
                                    onSave={handleSaveOrder}
                                />
                            </div>
                        </section>
                    </div>

                    {/* Sticky action bar: the total and the hand-off button never scroll away. */}
                    <div className="sticky bottom-20 z-30 mt-4 rounded-2xl bg-white p-3 shadow-lg md:bottom-4 dark:bg-zinc-800">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="min-w-[10rem] flex-1">
                                <OrderTotals order={order} compact />
                            </div>
                            <div className="flex w-full gap-2 sm:w-auto">
                                <Button
                                    text="Discard"
                                    icon="fa-solid fa-trash"
                                    onClick={() => setDiscardingDraft(true)}
                                    className="!min-h-[52px] flex-col !gap-0.5 !px-1 !text-xs sm:flex-row sm:!gap-2 sm:!px-5 sm:!text-base bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
                                />
                                <Button
                                    text={`Complete ${FormatCurrency(order.total)}`}
                                    icon="fa-solid fa-circle-check"
                                    onClick={handleSendToCheckout}
                                    loading={submitting}
                                    // The API rejects an empty or unnamed order anyway; greying
                                    // the button out saves the rep a round trip to find out.
                                    disabled={
                                        (order.lines?.length ?? 0) === 0 || !order.billingName
                                    }
                                    title={
                                        (order.lines?.length ?? 0) === 0
                                            ? "Add at least one item first"
                                            : !order.billingName
                                              ? "Enter the customer name first"
                                              : undefined
                                    }
                                    className="flex-1 bg-green-700 hover:bg-green-800 sm:flex-none dark:bg-green-600 dark:hover:bg-green-700"
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}

            {showCustomerSheet && order && (
                <CustomerDetailsSheet
                    order={order}
                    onSave={async (changes) => {
                        await handleSaveOrder(changes);
                        setFormVersion((value) => value + 1);
                    }}
                    onClose={() => setShowCustomerSheet(false)}
                />
            )}

            {showAddItem && (
                <AddItemModal
                    products={products}
                    onAdd={handleAddLine}
                    onClose={() => setShowAddItem(false)}
                />
            )}

            {editingLine?.lineType === "Upcharge" && (
                <UpchargeModal
                    line={editingLine}
                    parentLine={
                        order?.lines?.find((l) => l.id === editingLine.parentLineId) ?? editingLine
                    }
                    onSave={handleUpdateLine}
                    onClose={() => setEditingLine(null)}
                />
            )}

            {editingLine && editingLine.lineType !== "Upcharge" && (
                <EditLineModal
                    line={editingLine}
                    onSave={handleUpdateLine}
                    onClose={() => setEditingLine(null)}
                />
            )}

            {upchargingLine && (
                <UpchargeModal
                    parentLine={upchargingLine}
                    onSave={handleAddLine}
                    onClose={() => setUpchargingLine(null)}
                />
            )}

            {servicingLine && (
                <AddServiceModal
                    parentLine={servicingLine}
                    options={deliveryOptions}
                    products={products}
                    onAdd={handleAddLine}
                    onClose={() => setServicingLine(null)}
                />
            )}

            {removingLine && (
                <ConfirmationModal
                    title="Remove item"
                    message={`Remove "${removingLine.description}" from this order?`}
                    confirmText="Remove"
                    destructive
                    onConfirm={handleRemoveLine}
                    onCancel={() => setRemovingLine(null)}
                />
            )}

            {discardingDraft && (
                <ConfirmationModal
                    title="Discard draft"
                    message={`Discard order #${order?.orderNumber}? This cannot be undone.`}
                    confirmText="Discard"
                    destructive
                    onConfirm={handleDiscardDraft}
                    onCancel={() => setDiscardingDraft(false)}
                />
            )}
        </div>
    );
};

export default SalesPage;
