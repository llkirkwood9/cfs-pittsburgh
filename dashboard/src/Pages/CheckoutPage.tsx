import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import AcknowledgementSheet from "../Components/Checkout/AcknowledgementSheet";
import CheckoutQueue from "../Components/Checkout/CheckoutQueue";
import CommentsCard from "../Components/Checkout/CommentsCard";
import PaymentPanel from "../Components/Checkout/PaymentPanel";
import AddItemModal from "../Components/Sales/AddItemModal";
import AddServiceModal from "../Components/Sales/AddServiceModal";
import CustomerDetailsSheet from "../Components/Sales/CustomerDetailsSheet";
import EditLineModal from "../Components/Sales/EditLineModal";
import OrderLineList from "../Components/Sales/OrderLineList";
import OrderTotals from "../Components/Sales/OrderTotals";
import { useAuth } from "../Context/AuthContext";
import { FormatCurrency, IsAcknowledged } from "../Lib/ModelHelpers";
import { IsOnline } from "../Lib/Connection";
import { Toast } from "../Lib/Toast";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { Event } from "../Models/Event";
import type { Order } from "../Models/Order";
import type { OrderLine } from "../Models/OrderLine";
import type { OrderPayment, PaymentMethod } from "../Models/OrderPayment";
import type { OrderSummary } from "../Models/OrderSummary";
import type { Product } from "../Models/Product";
import { GetDeliveryOptions } from "../Services/DeliveryOptionServices";
import { GetActiveEvent } from "../Services/EventServices";
import {
    AddOrderLine,
    AddOrderPayment,
    CompleteOrder,
    DeleteOrderLine,
    DeleteOrderPayment,
    GetCheckoutQueue,
    GetOrder,
    ReopenOrder,
    UpdateOrder,
    UpdateOrderLine,
    VoidOrder,
} from "../Services/OrderServices";
import { GetProducts } from "../Services/ProductServices";

/** How often the queue re-polls, so a new hand-off shows up without anyone refreshing. */
const POLL_MS = 8000;

/**
 * The checkout table. The queue on the left fills itself as reps complete orders; the panel on
 * the right can still change the order, takes payment, collects the customer's initials and
 * signature, and prints the receipt.
 */
const CheckoutPage = () => {
    const { user } = useAuth();
    const { orderId } = useParams();
    const navigate = useNavigate();

    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [queue, setQueue] = useState<OrderSummary[]>([]);
    const [order, setOrder] = useState<Order | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [completing, setCompleting] = useState<boolean>(false);
    const [voiding, setVoiding] = useState<boolean>(false);

    const [showAddItem, setShowAddItem] = useState<boolean>(false);
    const [editingLine, setEditingLine] = useState<OrderLine | null>(null);
    const [servicingLine, setServicingLine] = useState<OrderLine | null>(null);
    const [removingLine, setRemovingLine] = useState<OrderLine | null>(null);
    const [showCustomerSheet, setShowCustomerSheet] = useState<boolean>(false);
    const [showAcknowledgements, setShowAcknowledgements] = useState<boolean>(false);

    const refreshQueue = useCallback(async (eventId: number) => {
        const list = await GetCheckoutQueue(eventId);
        setQueue(list);
        return list;
    }, []);

    const openOrder = useCallback(async (id: number) => {
        const loaded = await GetOrder(id);
        if (loaded) setOrder(loaded);
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

            const [list, catalog, options] = await Promise.all([
                refreshQueue(active.id),
                GetProducts(),
                GetDeliveryOptions(),
            ]);

            setProducts(catalog);
            setDeliveryOptions(options);

            if (orderId) await openOrder(Number(orderId));
            else if (list[0]?.id) await openOrder(list[0].id);

            setLoading(false);
        };

        load();
    }, [orderId, openOrder, refreshQueue]);

    useEffect(() => {
        if (!saleEvent?.id) return;

        const timer = setInterval(() => {
            // A poll that fails while the Wi-Fi is down keeps the queue on screen rather than
            // emptying it.
            GetCheckoutQueue(saleEvent.id!).then((list) => {
                if (IsOnline()) setQueue(list);
            });
        }, POLL_MS);

        return () => clearInterval(timer);
    }, [saleEvent?.id]);

    if (!user) return <Navigate to="/unauthorized" replace />;

    const applyResult = async (result: Order | null) => {
        if (!result) return;
        setOrder(result);
        if (saleEvent?.id) await refreshQueue(saleEvent.id);
    };

    const saveOrder = async (changes: Order) => {
        if (!order?.id) return;
        await applyResult(await UpdateOrder({ ...changes, id: order.id }));
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

    const handleAddPayment = async (payment: OrderPayment) => {
        if (!order?.id) return;
        await applyResult(await AddOrderPayment(order.id, payment));
    };

    const handleRemovePayment = async (paymentId: number) => {
        await applyResult(await DeleteOrderPayment(paymentId));
    };

    /** Choosing a card puts the card fee on the total; anything else takes it back off. */
    const handleMethodChange = async (method: PaymentMethod) => {
        if (!order?.id) return;
        await saveOrder({ applyCcProcessingFee: method === "VisaMc" });
    };

    const handleComplete = async () => {
        if (!order?.id) return;

        setCompleting(true);
        const result = await CompleteOrder(order.id);
        setCompleting(false);

        if (!result) return;

        Toast.Success(`Order #${result.orderNumber} completed.`);
        navigate(`/receipt/${result.id}`, {
            state: { from: "/checkout", label: "Back to checkout", autoPrint: true },
        });
    };

    const handleSendBack = async () => {
        if (!order?.id) return;

        const result = await ReopenOrder(order.id);
        if (!result) return;

        Toast.Info(`Order #${result.orderNumber} sent back to the floor.`);

        if (saleEvent?.id) {
            const list = await refreshQueue(saleEvent.id);
            setOrder(list[0]?.id ? await GetOrder(list[0].id) : null);
        }
    };

    const handleVoid = async () => {
        if (!order?.id) return;

        const result = await VoidOrder(order.id);
        setVoiding(false);

        if (!result) return;

        Toast.Info(`Order #${result.orderNumber} voided.`);

        if (saleEvent?.id) {
            const list = await refreshQueue(saleEvent.id);
            setOrder(list[0]?.id ? await GetOrder(list[0].id) : null);
        }
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
                <ListSkeleton rows={5} />
            </div>
        );
    }

    if (!saleEvent) {
        return (
            <div className="mx-auto max-w-lg p-6 text-center">
                <Icon icon="fa-solid fa-calendar-xmark" className="text-3xl text-zinc-400" />
                <h1 className="mt-3 text-xl font-bold">No active event</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    An administrator can activate one under Events.
                </p>
            </div>
        );
    }

    const closed = order?.status === "Completed" || order?.status === "Voided";
    const signed = Boolean(order?.customerSignature);
    const confirmed = Boolean(order?.customerInfoInitials);
    const initialled = Boolean(
        order?.warrantyInitials && order?.dropShipInitials && order?.advisoryInitials
    );
    const acknowledged = order ? IsAcknowledged(order) : false;

    return (
        <div className="mx-auto max-w-screen-2xl p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="text-xl font-bold">Checkout</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {queue.length} waiting &middot; {saleEvent.organization}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <section className="lg:col-span-2">
                    <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Waiting to pay
                    </h2>
                    <CheckoutQueue
                        orders={queue}
                        activeId={order?.id ?? null}
                        onSelect={openOrder}
                    />
                </section>

                <section className="lg:col-span-3">
                    {!order ? (
                        <div className="rounded-xl border-2 border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
                            <Icon
                                icon="fa-solid fa-hand-point-left"
                                className="text-3xl text-zinc-400"
                            />
                            <p className="mt-3 text-base font-semibold">Pick a customer</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h2 className="text-lg font-bold">
                                        #{order.orderNumber} &middot;{" "}
                                        {order.billingName || "No name"}
                                    </h2>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                            {closed ? order.status : "Awaiting payment"}
                                        </span>
                                        {!closed && (
                                            <Button
                                                text="Add item"
                                                icon="fa-solid fa-plus"
                                                onClick={openAddItem}
                                                className="min-h-[40px] bg-green-700 px-3 text-sm hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Checkout edits the order the same way the floor does - a
                                    forgotten protector is added here rather than sending the
                                    customer back across the room. */}
                                <OrderLineList
                                    lines={order.lines ?? []}
                                    readOnly={closed}
                                    onEdit={setEditingLine}
                                    onAddService={setServicingLine}
                                    onRemove={setRemovingLine}
                                    onQuantity={(line, quantity) =>
                                        handleUpdateLine({ id: line.id, quantity })
                                    }
                                />

                                <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                                    <OrderTotals order={order} />
                                </div>
                            </div>

                            <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                        Customer details
                                    </h3>
                                    <Button
                                        text="Hand to customer"
                                        icon="fa-solid fa-hand-holding-heart"
                                        onClick={() => setShowCustomerSheet(true)}
                                        className="min-h-[40px] px-3 text-sm"
                                    />
                                </div>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    {order.billingName || "No name yet"}
                                    {order.billingAddress ? ` · ${order.billingAddress}` : ""}
                                    {order.billingCity ? `, ${order.billingCity}` : ""}
                                    {order.billingState ? ` ${order.billingState}` : ""}
                                    {order.billingZip ? ` ${order.billingZip}` : ""}
                                </p>
                                {!(order.deliverySameAsBilling ?? true) && (
                                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                                        <Icon icon="fa-solid fa-truck" /> Deliver to{" "}
                                        {[
                                            order.deliveryName,
                                            order.deliveryAddress,
                                            order.deliveryCity,
                                            order.deliveryState,
                                            order.deliveryZip,
                                        ]
                                            .filter(Boolean)
                                            .join(", ")}
                                    </p>
                                )}
                                {order.referralName && (
                                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                                        Referred by {order.referralName}
                                    </p>
                                )}
                            </div>

                            <CommentsCard
                                key={order.id}
                                order={order}
                                readOnly={closed}
                                onSave={saveOrder}
                            />

                            <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Payment
                                </h3>
                                <PaymentPanel
                                    key={order.id}
                                    order={order}
                                    onAdd={handleAddPayment}
                                    onRemove={handleRemovePayment}
                                    onMethodChange={handleMethodChange}
                                />
                            </div>

                            <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                        Acknowledgements
                                    </h3>
                                    {!closed && (
                                        <Button
                                            text={signed ? "Redo" : "Hand to customer"}
                                            icon="fa-solid fa-file-signature"
                                            onClick={() => setShowAcknowledgements(true)}
                                            className="min-h-[40px] px-3 text-sm"
                                        />
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-4">
                                    <span
                                        className={`inline-flex items-center gap-2 text-sm font-medium ${
                                            confirmed
                                                ? "text-green-700 dark:text-green-400"
                                                : "text-zinc-500 dark:text-zinc-400"
                                        }`}
                                    >
                                        <Icon
                                            icon={
                                                confirmed
                                                    ? "fa-solid fa-circle-check"
                                                    : "fa-regular fa-circle"
                                            }
                                        />
                                        Details confirmed
                                        {confirmed && ` (${order.customerInfoInitials})`}
                                    </span>

                                    <span
                                        className={`inline-flex items-center gap-2 text-sm font-medium ${
                                            initialled
                                                ? "text-green-700 dark:text-green-400"
                                                : "text-zinc-500 dark:text-zinc-400"
                                        }`}
                                    >
                                        <Icon
                                            icon={
                                                initialled
                                                    ? "fa-solid fa-circle-check"
                                                    : "fa-regular fa-circle"
                                            }
                                        />
                                        Initials
                                        {initialled &&
                                            ` (${order.warrantyInitials}, ${order.dropShipInitials}, ${order.advisoryInitials})`}
                                    </span>

                                    <span
                                        className={`inline-flex items-center gap-2 text-sm font-medium ${
                                            signed
                                                ? "text-green-700 dark:text-green-400"
                                                : "text-zinc-500 dark:text-zinc-400"
                                        }`}
                                    >
                                        <Icon
                                            icon={
                                                signed
                                                    ? "fa-solid fa-circle-check"
                                                    : "fa-regular fa-circle"
                                            }
                                        />
                                        Signature
                                    </span>
                                </div>

                                {signed && (
                                    <img
                                        src={order.customerSignature ?? ""}
                                        alt="Customer signature"
                                        className="mt-3 h-20 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-600"
                                    />
                                )}
                            </div>

                            <div className="sticky bottom-20 z-30 rounded-2xl bg-white p-3 shadow-lg md:bottom-4 dark:bg-zinc-800">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="flex-1 text-sm">
                                        <span className="text-zinc-500 dark:text-zinc-400">
                                            Balance due{" "}
                                        </span>
                                        <span className="text-lg font-bold tabular-nums">
                                            {FormatCurrency(order.balanceDue)}
                                        </span>
                                    </p>

                                    {closed ? (
                                        <Button
                                            text="Print sales sheet"
                                            icon="fa-solid fa-print"
                                            onClick={() =>
                                                navigate(`/receipt/${order.id}`, {
                                                    state: {
                                                        from: "/checkout",
                                                        label: "Back to checkout",
                                                    },
                                                })
                                            }
                                            className="flex-1 sm:flex-none"
                                        />
                                    ) : (
                                        <div className="grid w-full grid-cols-[1fr_1fr_1.6fr] gap-2 sm:flex sm:w-auto">
                                            <Button
                                                text="Send back"
                                                icon="fa-solid fa-arrow-rotate-left"
                                                onClick={handleSendBack}
                                                className="!min-h-[52px] flex-col !gap-0.5 !px-1 !text-xs sm:flex-row sm:!gap-2 sm:!px-5 sm:!text-base bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                                            />
                                            <Button
                                                text="Void"
                                                icon="fa-solid fa-ban"
                                                onClick={() => setVoiding(true)}
                                                className="!min-h-[52px] flex-col !gap-0.5 !px-1 !text-xs sm:flex-row sm:!gap-2 sm:!px-5 sm:!text-base bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
                                            />
                                            <Button
                                                text="Complete &amp; print"
                                                icon="fa-solid fa-print"
                                                onClick={handleComplete}
                                                loading={completing}
                                                disabled={!acknowledged}
                                                title={
                                                    acknowledged
                                                        ? undefined
                                                        : "The customer needs to confirm their details, initial and sign first"
                                                }
                                                className="!min-h-[52px] flex-col !gap-0.5 !px-1 !text-xs sm:flex-row sm:!gap-2 sm:!px-5 sm:!text-base bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                                            />
                                        </div>
                                    )}
                                </div>

                                {!closed && !acknowledged && (
                                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                                        <Icon icon="fa-solid fa-file-signature" /> Hand the tablet
                                        to the customer to confirm their details, initial and sign
                                        before completing.
                                    </p>
                                )}
                                {!closed && (order.balanceDue ?? 0) > 0 && (
                                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                                        <Icon icon="fa-solid fa-triangle-exclamation" /> A balance
                                        will remain on this sale.
                                        <span className="hidden sm:inline">
                                            {" "}
                                            That is expected for layaway and financing, otherwise
                                            record the rest of the payment first.
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {showAddItem && (
                <AddItemModal
                    products={products}
                    onAdd={handleAddLine}
                    onClose={() => setShowAddItem(false)}
                />
            )}

            {editingLine && (
                <EditLineModal
                    line={editingLine}
                    onSave={handleUpdateLine}
                    onClose={() => setEditingLine(null)}
                />
            )}

            {servicingLine && (
                <AddServiceModal
                    parentLine={servicingLine}
                    options={deliveryOptions}
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

            {showCustomerSheet && order && (
                <CustomerDetailsSheet
                    order={order}
                    onSave={saveOrder}
                    onClose={() => setShowCustomerSheet(false)}
                />
            )}

            {showAcknowledgements && order && (
                <AcknowledgementSheet
                    order={order}
                    onSave={saveOrder}
                    onClose={() => setShowAcknowledgements(false)}
                />
            )}

            {voiding && (
                <ConfirmationModal
                    title="Void order"
                    message={`Void order #${order?.orderNumber}? It stays on file for the audit trail but drops out of the day's totals.`}
                    confirmText="Void"
                    destructive
                    onConfirm={handleVoid}
                    onCancel={() => setVoiding(false)}
                />
            )}
        </div>
    );
};

export default CheckoutPage;
