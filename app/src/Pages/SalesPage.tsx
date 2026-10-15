import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import GlassPanel from "../Components/Elements/GlassPanel";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Page from "../Components/Elements/Page";
import TabButton from "../Components/Elements/TabButton";
import Text from "../Components/Elements/Text";
import AddItemModal from "../Components/Sales/AddItemModal";
import AddServiceModal from "../Components/Sales/AddServiceModal";
import CustomerDetailsSheet from "../Components/Sales/CustomerDetailsSheet";
import CustomerForm from "../Components/Sales/CustomerForm";
import DraftTabs from "../Components/Sales/DraftTabs";
import EditLineModal from "../Components/Sales/EditLineModal";
import OrderLineList from "../Components/Sales/OrderLineList";
import OrderTotals from "../Components/Sales/OrderTotals";
import UpchargeModal from "../Components/Sales/UpchargeModal";
import { useAuth } from "../Context/AuthContext";
import { useActiveEventChange } from "../Hooks/UseActiveEventChange";
import { useBreakpoint } from "../Hooks/UseBreakpoint";
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
    ReorderOrderLines,
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
    const { lg, sm } = useBreakpoint();

    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [reps, setReps] = useState<string[]>([]);

    const [drafts, setDrafts] = useState<OrderSummary[]>([]);
    const [order, setOrder] = useState<Order | null>(null);

    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
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
    // up what the customer typed. Keying on updatedAt instead would remount on every save and
    // pull focus out of the field the rep just moved into.
    const [formVersion, setFormVersion] = useState<number>(0);

    const refreshDrafts = useCallback(async (eventId: number) => {
        const list = await GetDrafts(eventId);
        setDrafts(list);
        return list;
    }, []);

    const load = useCallback(async () => {
        const active = await GetActiveEvent();
        setSaleEvent(active);
        // Drafts belong to their event, so a different event starts from its own.
        setDrafts([]);
        setOrder(null);

        if (!active?.id) return;

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
    }, []);

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, [load]);

    const checkActiveEvent = useActiveEventChange(loading ? undefined : (saleEvent?.id ?? null), load);

    if (!user) return <Redirect href="/unauthorized" />;

    // Pull down to pick up drafts started on another device and fresh stock counts.
    const handleRefresh = async () => {
        setRefreshing(true);
        // A change of active event reloads everything; otherwise just the drafts and stock.
        const switched = await checkActiveEvent();
        if (!switched && saleEvent?.id) {
            const [list, catalog] = await Promise.all([refreshDrafts(saleEvent.id), GetProducts()]);
            if (catalog.length) setProducts(catalog);
            const keep = order?.id && list.some((d) => d.id === order.id) ? order.id : list[0]?.id;
            setOrder(keep ? await GetOrder(keep) : null);
        } else if (!switched) {
            await load();
        }
        setRefreshing(false);
    };

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
            <Page navbar>
                <ListSkeleton rows={6} />
            </Page>
        );
    }

    if (!saleEvent) {
        return (
            <Page navbar onRefresh={handleRefresh} refreshing={refreshing}>
                <View className="mx-auto max-w-lg items-center p-6">
                    <Icon icon="fa-solid fa-calendar-xmark" className="text-3xl text-zinc-400" />
                    <Text className="mt-3 text-xl font-bold">No active event</Text>
                    <Text className="mt-1 text-center text-sm text-zinc-600 dark:text-zinc-400">An administrator can activate one under Events.</Text>
                </View>
            </Page>
        );
    }

    const refresh = <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />;

    // Keyed, so switching panes on a phone mounts the other one rather than restyling this one.
    const itemsPane = order && (
        <View key="items">
            <View className="mb-3 flex-row items-center justify-between gap-2">
                <Text className="shrink font-bold">
                    Items
                    <Text className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                        {"  "}Order #{order.orderNumber}
                    </Text>
                </Text>
                <Button
                    text="Add item"
                    icon="fa-solid fa-plus"
                    onClick={openAddItem}
                    className="bg-green-700 dark:bg-green-600"
                />
            </View>

            <OrderLineList
                lines={order.lines ?? []}
                onEdit={setEditingLine}
                onAddService={setServicingLine}
                onAddUpcharge={setUpchargingLine}
                onReorder={handleReorderLines}
                onRemove={setRemovingLine}
                onQuantity={(line, quantity) => handleUpdateLine({ id: line.id, quantity })}
            />
        </View>
    );

    const customerPane = order && (
        <View key="customer" className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
            <Button
                text="Hand device to customer"
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
        </View>
    );

    return (
        <Page navbar scroll={false} edges={["left", "right", "bottom"]}>
            <View className="px-3 pt-3 sm:px-4">
                <View className="mb-3 flex-row flex-wrap items-baseline justify-between gap-2">
                    <Text className="text-xl font-bold">{saleEvent.organization}</Text>
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                        {drafts.length} open order{drafts.length === 1 ? "" : "s"}
                    </Text>
                </View>

                <DraftTabs
                    drafts={drafts}
                    activeId={order?.id ?? null}
                    onSelect={handleSelectDraft}
                    onNew={handleNewDraft}
                    creating={creating}
                />

                {order && !lg && (
                    <View className="mt-3 flex-row gap-2">
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
                    </View>
                )}
            </View>

            {!order ? (
                <ScrollView className="flex-1" contentContainerClassName="p-3 sm:p-4" refreshControl={refresh}>
                    <View className="items-center rounded-xl border-2 border-dashed border-zinc-300 py-16 dark:border-zinc-700">
                        <Icon icon="fa-solid fa-user-plus" className="text-3xl text-zinc-400" />
                        <Text className="mt-3 font-semibold">No order open</Text>
                        <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            Tap New to start one for the customer in front of you.
                        </Text>
                    </View>
                </ScrollView>
            ) : lg ? (
                // Side by side on a wide tablet: the items take three fifths, the customer two.
                <View className="flex-1 flex-row gap-4 px-4 pt-4">
                    <ScrollView
                        className="flex-[3]"
                        contentContainerClassName="pb-4"
                        refreshControl={refresh}
                        keyboardShouldPersistTaps="handled"
                    >
                        {itemsPane}
                    </ScrollView>
                    <ScrollView
                        className="flex-[2]"
                        contentContainerClassName="pb-4"
                        keyboardShouldPersistTaps="handled"
                        automaticallyAdjustKeyboardInsets
                    >
                        {customerPane}
                    </ScrollView>
                </View>
            ) : (
                <ScrollView
                    className="flex-1"
                    contentContainerClassName="p-3 pb-4 sm:p-4"
                    refreshControl={refresh}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets
                >
                    {pane === "items" ? itemsPane : customerPane}
                </ScrollView>
            )}

            {/* The action bar: the total and the hand-off button never scroll away. */}
            {order && (
                <View className="px-3 pb-2 sm:px-4">
                    <GlassPanel className="rounded-2xl p-3 raised-lg" fallbackClassName="bg-white dark:bg-zinc-800">
                        <View className="flex-row flex-wrap items-center gap-3">
                            <View className="min-w-[160px] flex-1">
                                <OrderTotals order={order} compact />
                            </View>
                            <View className={sm ? "flex-row gap-2" : "w-full flex-row gap-2"}>
                                <Button
                                    text="Discard"
                                    icon="fa-solid fa-trash"
                                    onClick={() => setDiscardingDraft(true)}
                                    className="min-h-[52px] bg-red-700 dark:bg-red-600"
                                />
                                <Button
                                    text={`Complete ${FormatCurrency(order.total)}`}
                                    icon="fa-solid fa-circle-check"
                                    onClick={handleSendToCheckout}
                                    loading={submitting}
                                    // The API rejects an empty or unnamed order anyway; greying
                                    // the button out saves the rep a round trip to find out.
                                    disabled={(order.lines?.length ?? 0) === 0 || !order.billingName}
                                    title={
                                        (order.lines?.length ?? 0) === 0
                                            ? "Add at least one item first"
                                            : !order.billingName
                                              ? "Enter the customer name first"
                                              : undefined
                                    }
                                    className={
                                        sm
                                            ? "min-h-[52px] bg-green-700 dark:bg-green-600"
                                            : "min-h-[52px] flex-1 bg-green-700 dark:bg-green-600"
                                    }
                                />
                            </View>
                        </View>
                    </GlassPanel>
                </View>
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
        </Page>
    );
};

export default SalesPage;
