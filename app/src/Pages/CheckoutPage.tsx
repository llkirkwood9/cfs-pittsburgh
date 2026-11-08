import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
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
import { useActiveEventChange } from "../Hooks/UseActiveEventChange";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { useBreakpoint } from "../Hooks/UseBreakpoint";
import { cx } from "../Lib/ClassNames";
import { useCheckoutQueue } from "@shared/Hooks/useCheckoutQueue";
import {
    AcknowledgementChecks,
    AcknowledgementStateOf,
    BillingSummaryText,
    DeliverToText,
} from "@shared/Lib/Checkout";
import { FormatCurrency } from "@shared/Lib/Format";
import { Paths } from "../Lib/ScreenLinks";

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
            <Icon
                icon={done ? "fa-solid fa-circle-check" : "fa-regular fa-circle"}
                className={color}
            />
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
    const { orderId } = useLocalSearchParams<{ orderId?: string }>();
    const { lg, sm } = useBreakpoint();

    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [showCustomerSheet, setShowCustomerSheet] = useState<boolean>(false);
    const [showAcknowledgements, setShowAcknowledgements] = useState<boolean>(false);

    const {
        saleEvent,
        queue,
        order,
        products,
        deliveryOptions,
        loading,
        load,
        reloadQueue,
        openOrder,
        advance,
        completing,
        complete,
        sendBack,
        voiding,
        setVoiding,
        voidOrder,
        editor,
    } = useCheckoutQueue(orderId ? Number(orderId) : undefined);

    const checkActiveEvent = useActiveEventChange(
        loading ? undefined : (saleEvent?.id ?? null),
        load
    );

    // A change of active event reloads everything; otherwise just the queue and the order.
    const reload = async () => {
        if (!(await checkActiveEvent())) await reloadQueue();
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
    };

    // Back on this screen: read it again.
    useRefreshOnFocus(reload);

    const openReceipt = (id: number) => router.push(Paths.receipt(id));

    // The receipt opens over this screen, which moves on to the next customer behind it.
    const handleComplete = async () => {
        const result = await complete();
        if (!result?.id) return;
        openReceipt(result.id);
        await advance();
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
                        A manager can activate one under Events.
                    </Text>
                </View>
            </Page>
        );
    }

    const ack = AcknowledgementStateOf(order);
    const { closed, signed, confirmed, initialled, acknowledged } = ack;
    const deliverTo = order ? DeliverToText(order) : null;

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
            <Icon
                icon={lg ? "fa-solid fa-hand-point-left" : "fa-solid fa-hand-point-up"}
                className="text-3xl text-zinc-400"
            />
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
                                onClick={editor.openAddItem}
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
                    onEdit={editor.setEditingLine}
                    onAddService={editor.setServicingLine}
                    onAddUpcharge={editor.setUpchargingLine}
                    onReorder={editor.reorderLines}
                    onRemove={editor.setRemovingLine}
                    onQuantity={editor.changeQuantity}
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
                    {BillingSummaryText(order)}
                </Text>
                {deliverTo !== null && (
                    <View className="mt-1 flex-row gap-1.5">
                        <Icon
                            icon="fa-solid fa-truck"
                            className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400"
                        />
                        <Text className="flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                            Deliver to {deliverTo}
                        </Text>
                    </View>
                )}
                {order.referralName ? (
                    <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Referred by {order.referralName}
                    </Text>
                ) : null}
            </Card>

            <CommentsCard
                key={order.id}
                order={order}
                readOnly={closed}
                onSave={editor.saveOrder}
            />

            <Card title="Payment">
                <PaymentPanel
                    key={order.id}
                    order={order}
                    onAdd={editor.addPayment}
                    onRemove={editor.removePayment}
                    onMethodChange={editor.changeMethod}
                    onWaiveFee={editor.waiveFee}
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
                    <Check done={confirmed} text={AcknowledgementChecks(order, ack).details} />
                    <Check done={initialled} text={AcknowledgementChecks(order, ack).initials} />
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
                    <ScrollView
                        className="flex-[2]"
                        contentContainerClassName="pb-4"
                        refreshControl={refresh}
                    >
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
                                        onClick={sendBack}
                                        className={cx(
                                            "min-h-[52px] bg-zinc-500 dark:bg-zinc-600",
                                            !sm && "flex-1 px-2 text-xs"
                                        )}
                                    />
                                    <Button
                                        text="Void"
                                        icon="fa-solid fa-ban"
                                        onClick={() => setVoiding(true)}
                                        className={cx(
                                            "min-h-[52px] bg-red-700 dark:bg-red-600",
                                            !sm && "flex-1 px-2 text-xs"
                                        )}
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

            {editor.showAddItem && (
                <AddItemModal
                    products={products}
                    onAdd={editor.addLine}
                    onClose={editor.closeAddItem}
                />
            )}

            {editor.editingLine?.lineType === "Upcharge" && (
                <UpchargeModal
                    line={editor.editingLine}
                    parentLine={editor.upchargeParent(editor.editingLine)}
                    onSave={editor.updateLine}
                    onClose={() => editor.setEditingLine(null)}
                />
            )}

            {editor.editingLine && editor.editingLine.lineType !== "Upcharge" && (
                <EditLineModal
                    line={editor.editingLine}
                    onSave={editor.updateLine}
                    onClose={() => editor.setEditingLine(null)}
                />
            )}

            {editor.upchargingLine && (
                <UpchargeModal
                    parentLine={editor.upchargingLine}
                    onSave={editor.addLine}
                    onClose={() => editor.setUpchargingLine(null)}
                />
            )}

            {editor.servicingLine && (
                <AddServiceModal
                    parentLine={editor.servicingLine}
                    options={deliveryOptions}
                    products={products}
                    onAdd={editor.addLine}
                    onClose={() => editor.setServicingLine(null)}
                />
            )}

            {editor.removingLine && (
                <ConfirmationModal
                    title="Remove item"
                    message={`Remove "${editor.removingLine.description}" from this order?`}
                    confirmText="Remove"
                    destructive
                    onConfirm={editor.removeLine}
                    onCancel={() => editor.setRemovingLine(null)}
                />
            )}

            {showCustomerSheet && order && (
                <CustomerDetailsSheet
                    order={order}
                    onSave={editor.saveOrder}
                    onClose={() => setShowCustomerSheet(false)}
                />
            )}

            {showAcknowledgements && order && (
                <AcknowledgementSheet
                    order={order}
                    onSave={editor.saveOrder}
                    onClose={() => setShowAcknowledgements(false)}
                />
            )}

            {voiding && (
                <ConfirmationModal
                    title="Void order"
                    message={`Void order #${order?.orderNumber}? It stays on file for the audit trail but drops out of the day's totals.`}
                    confirmText="Void"
                    destructive
                    onConfirm={voidOrder}
                    onCancel={() => setVoiding(false)}
                />
            )}
        </Page>
    );
};

export default CheckoutPage;
