import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import AcknowledgementSheet from "../Components/Checkout/AcknowledgementSheet";
import CheckoutQueue from "../Components/Checkout/CheckoutQueue";
import CommentsCard from "../Components/Checkout/CommentsCard";
import PaymentPanel from "../Components/Checkout/PaymentPanel";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import GlassPanel from "../Components/Elements/GlassPanel";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Page from "../Components/Elements/Page";
import Text from "../Components/Elements/Text";
import AddItemModal from "../Components/Sales/AddItemModal";
import AddServiceModal from "../Components/Sales/AddServiceModal";
import CustomerDetailsSheet from "../Components/Sales/CustomerDetailsSheet";
import EditLineModal from "../Components/Sales/EditLineModal";
import OrderLineList from "../Components/Sales/OrderLineList";
import OrderTotals from "../Components/Sales/OrderTotals";
import UpchargeModal from "../Components/Sales/UpchargeModal";
import { useAuth } from "../Context/AuthContext";
import { useActiveEventChange } from "../Hooks/UseActiveEventChange";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { useBreakpoint } from "../Hooks/UseBreakpoint";
import { cx } from "../Lib/ClassNames";
import { CheckoutQueueCounted } from "../Lib/CheckoutWaiting";
import { IsOnline } from "../Lib/Connection";
import { FormatCurrency, InitialsFor, IsAcknowledged, RequiredTerms } from "../Lib/ModelHelpers";
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
    ReorderOrderLines,
    UpdateOrder,
    UpdateOrderLine,
    VoidOrder,
} from "../Services/OrderServices";
import { GetProducts } from "../Services/ProductServices";

/**
 * How often the queue re-polls, so a new hand-off shows up without anyone refreshing. It also
 * keeps the Checkout tab's count current while this screen is open.
 */
const POLL_MS = 5000;

/** A white card with an uppercase heading, as the checkout panel's sections are. */
const Card = ({
    title,
    action,
    children,
}: {
    title: string;
    action?: ReactNode;
    children: ReactNode;
}) => (
    <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
        <View className="mb-3 min-h-[40px] flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {title}
            </Text>
            {action}
        </View>
        {children}
    </View>
);

/** One of the acknowledgement checks: a tick when done. */
const Check = ({ done, text }: { done: boolean; text: string }) => {
    const color = done ? "text-green-700 dark:text-green-400" : "text-zinc-500 dark:text-zinc-400";
    return (
        <View className="flex-row items-center gap-2">
            <Icon icon={done ? "fa-solid fa-circle-check" : "fa-regular fa-circle"} className={color} />
            <Text className={cx("text-sm font-medium", color)}>{text}</Text>
        </View>
    );
};

/**
 * The checkout table. The queue fills itself as reps complete orders; the panel beside it (below
 * it on a phone) can still change the order, takes payment, collects the customer's initials and
 * signature, then opens the receipt to print or email.
 */
const CheckoutPage = () => {
    const { user } = useAuth();
    const { orderId } = useLocalSearchParams<{ orderId?: string }>();
    const { lg, sm } = useBreakpoint();

    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [queue, setQueue] = useState<OrderSummary[]>([]);
    const [order, setOrder] = useState<Order | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [completing, setCompleting] = useState<boolean>(false);
    const [voiding, setVoiding] = useState<boolean>(false);

    const [showAddItem, setShowAddItem] = useState<boolean>(false);
    const [editingLine, setEditingLine] = useState<OrderLine | null>(null);
    const [servicingLine, setServicingLine] = useState<OrderLine | null>(null);
    const [upchargingLine, setUpchargingLine] = useState<OrderLine | null>(null);
    const [removingLine, setRemovingLine] = useState<OrderLine | null>(null);
    const [showCustomerSheet, setShowCustomerSheet] = useState<boolean>(false);
    const [showAcknowledgements, setShowAcknowledgements] = useState<boolean>(false);
    // Orders this device is completing, voiding or sending back, so the check below doesn't take
    // its own work for someone else's.
    const closedHere = useRef<Set<number>>(new Set());

    const refreshQueue = useCallback(async (eventId: number) => {
        const list = await GetCheckoutQueue(eventId);
        setQueue(list);
        if (IsOnline()) CheckoutQueueCounted(list.length);
        return list;
    }, []);

    const openOrder = useCallback(async (id: number) => {
        const loaded = await GetOrder(id);
        if (loaded) setOrder(loaded);
    }, []);

    const load = useCallback(async () => {
        const active = await GetActiveEvent();
        setSaleEvent(active);

        if (!active?.id) {
            setQueue([]);
            setOrder(null);
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
        else setOrder(null);
    }, [orderId, openOrder, refreshQueue]);

    useEffect(() => {
        setLoading(true);
        load().finally(() => setLoading(false));
    }, [load]);

    useEffect(() => {
        if (!saleEvent?.id) return;

        const timer = setInterval(() => {
            // A poll that fails while the Wi-Fi is down keeps the queue on screen rather than
            // emptying it.
            GetCheckoutQueue(saleEvent.id!).then((list) => {
                if (!IsOnline()) return;
                setQueue(list);
                CheckoutQueueCounted(list.length);
            });
        }, POLL_MS);

        return () => clearInterval(timer);
    }, [saleEvent?.id]);

    // Someone else may finish the order on screen - complete or void it at another device, or
    // send it back to the floor. Once it drops out of the queue, look it up and close it here too,
    // so nobody keeps working on a sale that is already done.
    useEffect(() => {
        if (!order?.id || order.status !== "AwaitingCheckout") return;
        if (queue.some((o) => o.id === order.id) || closedHere.current.has(order.id)) return;

        let cancelled = false;
        GetOrder(order.id).then((latest) => {
            if (cancelled || !IsOnline() || latest?.status === "AwaitingCheckout") return;
            const what =
                latest?.status === "Completed"
                    ? "completed"
                    : latest?.status === "Voided"
                      ? "voided"
                      : latest?.status === "Draft"
                        ? "sent back to the sales floor"
                        : "removed";
            Toast.Info(`Order #${order.orderNumber} was ${what} on another device.`);
            setOrder(null);
        });
        return () => {
            cancelled = true;
        };
    }, [queue, order?.id, order?.status, order?.orderNumber]);

    const checkActiveEvent = useActiveEventChange(loading ? undefined : (saleEvent?.id ?? null), load);

    const reload = async () => {
        // A change of active event reloads everything; otherwise just the queue and the order.
        const switched = await checkActiveEvent();
        if (!switched && saleEvent?.id) {
            await refreshQueue(saleEvent.id);
            if (order?.id) await openOrder(order.id);
        } else if (!switched) {
            await load();
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
    };

    // Back on this screen: read it again.
    useRefreshOnFocus(reload);

    if (!user) return <Redirect href="/unauthorized" />;

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

    const handleReorderLines = async (itemIds: number[]) => {
        if (!order?.id) return;
        await applyResult(await ReorderOrderLines(order.id, itemIds));
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

    /** No card fee on this order, even when it is paid by card - or the fee back on. */
    const handleWaiveFee = async (waive: boolean) => {
        if (!order?.id) return;
        await saveOrder({ waiveCcProcessingFee: waive });
    };

    const openReceipt = (id: number) =>
        router.push({ pathname: "/receipt/[orderId]", params: { orderId: String(id) } });

    const handleComplete = async () => {
        if (!order?.id) return;
        const closing = order.id;
        closedHere.current.add(closing);

        setCompleting(true);
        const result = await CompleteOrder(order.id);
        setCompleting(false);

        if (!result?.id) {
            closedHere.current.delete(closing);
            return;
        }

        Toast.Success(`Order #${result.orderNumber} completed.`);
        openReceipt(result.id);
        if (saleEvent?.id) {
            const list = await refreshQueue(saleEvent.id);
            setOrder(list[0]?.id ? await GetOrder(list[0].id) : null);
        }
    };

    const handleSendBack = async () => {
        if (!order?.id) return;
        const closing = order.id;
        closedHere.current.add(closing);

        const result = await ReopenOrder(order.id);
        if (!result) {
            closedHere.current.delete(closing);
            return;
        }

        Toast.Info(`Order #${result.orderNumber} sent back to the floor.`);

        if (saleEvent?.id) {
            const list = await refreshQueue(saleEvent.id);
            setOrder(list[0]?.id ? await GetOrder(list[0].id) : null);
        }
    };

    const handleVoid = async () => {
        if (!order?.id) return;
        const closing = order.id;
        closedHere.current.add(closing);

        const result = await VoidOrder(order.id);
        setVoiding(false);

        if (!result) {
            closedHere.current.delete(closing);
            return;
        }

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
            <Page navbar>
                <ListSkeleton rows={5} />
            </Page>
        );
    }

    if (!saleEvent) {
        return (
            <Page navbar onRefresh={handleRefresh} refreshing={refreshing}>
                <View className="mx-auto max-w-lg items-center p-6">
                    <Icon icon="fa-solid fa-calendar-xmark" className="text-3xl text-zinc-400" />
                    <Text className="mt-3 text-xl font-bold">No active event</Text>
                    <Text className="mt-1 text-center text-sm text-zinc-600 dark:text-zinc-400">
                        An administrator can activate one under Events.
                    </Text>
                </View>
            </Page>
        );
    }

    const closed = order?.status === "Completed" || order?.status === "Voided";
    const signed = Boolean(order?.customerSignature);
    // Only the statements this order needs: a take-home sale skips some of them.
    const required = order ? RequiredTerms(order) : [];
    const detailsNeeded = required.includes("customerInfo");
    const confirmed = !detailsNeeded || Boolean(order?.customerInfoInitials);
    const initialsNeeded = required.filter((key) => key !== "customerInfo");
    const initialled = Boolean(order) && initialsNeeded.every((key) => InitialsFor(order!, key));
    const initialsText = order
        ? initialsNeeded.map((key) => InitialsFor(order, key)).join(", ")
        : "";
    const acknowledged = order ? IsAcknowledged(order) : false;

    const queuePane = (
        <View>
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Waiting to pay
            </Text>
            <CheckoutQueue orders={queue} activeId={order?.id ?? null} onSelect={openOrder} />
        </View>
    );

    const orderPane = !order ? (
        <View className="items-center rounded-xl border-2 border-dashed border-zinc-300 py-16 dark:border-zinc-700">
            <Icon icon={lg ? "fa-solid fa-hand-point-left" : "fa-solid fa-hand-point-up"} className="text-3xl text-zinc-400" />
            <Text className="mt-3 font-semibold">Pick a customer</Text>
        </View>
    ) : (
        <View className="gap-4">
            <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
                <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
                    <Text className="shrink text-lg font-bold">
                        #{order.orderNumber} · {order.billingName || "No name"}
                    </Text>
                    <View className="flex-row flex-wrap items-center gap-2">
                        <View className="rounded-full bg-amber-100 px-3 py-1 dark:bg-amber-900/50">
                            <Text className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                {closed ? order.status : "Awaiting payment"}
                            </Text>
                        </View>
                        {!closed && (
                            <Button
                                text="Add item"
                                icon="fa-solid fa-plus"
                                onClick={openAddItem}
                                className="min-h-[40px] bg-green-700 px-3 text-sm dark:bg-green-600"
                            />
                        )}
                    </View>
                </View>

                {/* Checkout edits the order the same way the floor does - a forgotten protector
                    is added here rather than sending the customer back across the room. */}
                <OrderLineList
                    lines={order.lines ?? []}
                    readOnly={closed}
                    onEdit={setEditingLine}
                    onAddService={setServicingLine}
                    onAddUpcharge={setUpchargingLine}
                    onReorder={handleReorderLines}
                    onRemove={setRemovingLine}
                    onQuantity={(line, quantity) => handleUpdateLine({ id: line.id, quantity })}
                />

                <View className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                    <OrderTotals order={order} />
                </View>
            </View>

            <Card
                title="Customer details"
                action={
                    <Button
                        text="Hand to customer"
                        icon="fa-solid fa-hand-holding-heart"
                        onClick={() => setShowCustomerSheet(true)}
                        className="min-h-[40px] px-3 text-sm"
                    />
                }
            >
                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                    {order.billingName || "No name yet"}
                    {order.billingAddress ? ` · ${order.billingAddress}` : ""}
                    {order.billingCity ? `, ${order.billingCity}` : ""}
                    {order.billingState ? ` ${order.billingState}` : ""}
                    {order.billingZip ? ` ${order.billingZip}` : ""}
                </Text>
                {!(order.deliverySameAsBilling ?? true) && (
                    <View className="mt-1 flex-row gap-1.5">
                        <Icon icon="fa-solid fa-truck" className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400" />
                        <Text className="flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                            Deliver to{" "}
                            {[
                                order.deliveryName,
                                order.deliveryAddress,
                                order.deliveryCity,
                                order.deliveryState,
                                order.deliveryZip,
                            ]
                                .filter(Boolean)
                                .join(", ")}
                        </Text>
                    </View>
                )}
                {order.referralName ? (
                    <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Referred by {order.referralName}
                    </Text>
                ) : null}
            </Card>

            <CommentsCard key={order.id} order={order} readOnly={closed} onSave={saveOrder} />

            <Card title="Payment">
                <PaymentPanel
                    key={order.id}
                    order={order}
                    onAdd={handleAddPayment}
                    onRemove={handleRemovePayment}
                    onMethodChange={handleMethodChange}
                    onWaiveFee={handleWaiveFee}
                />
            </Card>

            <Card
                title="Acknowledgements"
                action={
                    !closed ? (
                        <Button
                            text={signed ? "Redo" : "Hand to customer"}
                            icon="fa-solid fa-file-signature"
                            onClick={() => setShowAcknowledgements(true)}
                            className="min-h-[40px] px-3 text-sm"
                        />
                    ) : undefined
                }
            >
                <View className="flex-row flex-wrap items-center gap-4">
                    <Check
                        done={confirmed}
                        text={
                            !detailsNeeded
                                ? "Details not needed"
                                : `Details confirmed${confirmed ? ` (${order.customerInfoInitials})` : ""}`
                        }
                    />
                    <Check
                        done={initialled}
                        text={`Initials${
                            initialled
                                ? initialsText && ` (${initialsText})`
                                : ""
                        }`}
                    />
                    <Check done={signed} text="Signature" />
                </View>

                {signed && (
                    <View className="mt-3 h-20 w-48 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-600">
                        <Image
                            source={{ uri: order.customerSignature ?? "" }}
                            contentFit="contain"
                            style={{ flex: 1 }}
                            accessibilityLabel="Customer signature"
                        />
                    </View>
                )}
            </Card>
        </View>
    );

    const refresh = <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />;

    return (
        <Page navbar scroll={false} edges={["left", "right", "bottom"]}>
            <View className="mb-1 flex-row flex-wrap items-baseline justify-between gap-2 px-3 pt-3 sm:px-4">
                <Text className="text-xl font-bold">Checkout</Text>
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                    {queue.length} waiting · {saleEvent.organization}
                </Text>
            </View>

            {lg ? (
                <View className="flex-1 flex-row gap-4 px-4 pt-2">
                    <ScrollView className="flex-[2]" contentContainerClassName="pb-4" refreshControl={refresh}>
                        {queuePane}
                    </ScrollView>
                    <ScrollView
                        className="flex-[3]"
                        contentContainerClassName="pb-4"
                        keyboardShouldPersistTaps="handled"
                        automaticallyAdjustKeyboardInsets
                    >
                        {orderPane}
                    </ScrollView>
                </View>
            ) : (
                <ScrollView
                    className="flex-1"
                    contentContainerClassName="gap-4 p-3 pb-4 sm:p-4"
                    refreshControl={refresh}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets
                >
                    {queuePane}
                    {orderPane}
                </ScrollView>
            )}

            {order && (
                <View className="px-3 pb-2 sm:px-4">
                    <GlassPanel className="rounded-2xl p-3 raised-lg">
                        <View className="flex-row flex-wrap items-center gap-2">
                            <Text className="flex-1 text-sm text-zinc-500 dark:text-zinc-400">
                                Balance due{" "}
                                <Text className="text-lg font-bold tabular-nums">
                                    {FormatCurrency(order.balanceDue)}
                                </Text>
                            </Text>

                            {closed ? (
                                <Button
                                    text="Print sales sheet"
                                    icon="fa-solid fa-print"
                                    onClick={() => order.id && openReceipt(order.id)}
                                />
                            ) : (
                                <View className={sm ? "flex-row gap-2" : "w-full flex-row gap-2"}>
                                    <Button
                                        text="Send back"
                                        icon="fa-solid fa-arrow-rotate-left"
                                        onClick={handleSendBack}
                                        className={cx("min-h-[52px] bg-zinc-500 dark:bg-zinc-600", !sm && "flex-1 px-2 text-xs")}
                                    />
                                    <Button
                                        text="Void"
                                        icon="fa-solid fa-ban"
                                        onClick={() => setVoiding(true)}
                                        className={cx("min-h-[52px] bg-red-700 dark:bg-red-600", !sm && "flex-1 px-2 text-xs")}
                                    />
                                    <Button
                                        text="Complete sale"
                                        icon="fa-solid fa-circle-check"
                                        onClick={handleComplete}
                                        loading={completing}
                                        disabled={!acknowledged}
                                        title={
                                            acknowledged
                                                ? undefined
                                                : "The customer needs to confirm their details, initial and sign first"
                                        }
                                        className={cx(
                                            "min-h-[52px] bg-green-700 dark:bg-green-600",
                                            !sm && "flex-[1.6] px-2 text-xs"
                                        )}
                                    />
                                </View>
                            )}
                        </View>

                        {!closed && !acknowledged && (
                            <Text className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                                The customer still needs to initial and sign.
                            </Text>
                        )}
                        {!closed && (order.balanceDue ?? 0) > 0 && (
                            <Text className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                                A balance will remain on this sale.
                            </Text>
                        )}
                    </GlassPanel>
                </View>
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
        </Page>
    );
};

export default CheckoutPage;
