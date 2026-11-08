import { useState } from "react";
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
import { useActiveEventChange } from "../Hooks/UseActiveEventChange";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { useBreakpoint } from "../Hooks/UseBreakpoint";
import { useSalesFloor } from "@shared/Hooks/useSalesFloor";
import { FormatCurrency } from "@shared/Lib/Format";
import { SendToCheckoutBlock } from "@shared/Lib/Sales";

/**
 * The sales floor. A rep keeps as many drafts open as they have customers, builds each one from
 * the catalog, then hands it to the checkout table with one button.
 */
const SalesPage = () => {
    const { lg, sm } = useBreakpoint();

    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [pane, setPane] = useState<"items" | "customer">("items");
    const [showCustomerSheet, setShowCustomerSheet] = useState<boolean>(false);

    // Bumped only when the customer sheet writes back, which remounts the rep's form so it picks
    // up what the customer typed. Keying on updatedAt instead would remount on every save and
    // pull focus out of the field the rep just moved into.
    const [formVersion, setFormVersion] = useState<number>(0);

    const {
        saleEvent,
        products,
        deliveryOptions,
        reps,
        drafts,
        order,
        loading,
        load,
        reloadDrafts,
        creating,
        submitting,
        newDraft,
        selectDraft,
        discardingDraft,
        setDiscardingDraft,
        discardDraft,
        sendToCheckout,
        editor,
    } = useSalesFloor(() => setPane("customer"));

    const checkActiveEvent = useActiveEventChange(
        loading ? undefined : (saleEvent?.id ?? null),
        load
    );

    // Pull down to pick up drafts started on another device and fresh stock counts. A change of
    // active event reloads everything; otherwise just the drafts and stock.
    const reload = async () => {
        if (!(await checkActiveEvent())) await reloadDrafts();
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
    };

    // Back on this screen: read it again.
    useRefreshOnFocus(reload);

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
                    <Text className="mt-1 text-center text-sm text-zinc-600 dark:text-zinc-400">
                        A manager can activate one under Events.
                    </Text>
                </View>
            </Page>
        );
    }

    const refresh = <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />;
    const sendBlock = order ? SendToCheckoutBlock(order) : undefined;

    // Keyed, so switching panes on a phone mounts the other one rather than restyling this one.
    const itemsPane = order && (
        <View key="items">
            <View className="mb-3 flex-row items-center justify-between gap-2">
                <Text className="shrink font-bold">
                    Items
                    <Text className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                        {"  "}
                        {order.orderNumber ? `Order #${order.orderNumber}` : "New order"}
                    </Text>
                </Text>
                <Button
                    text="Add item"
                    icon="fa-solid fa-plus"
                    onClick={editor.openAddItem}
                    className="bg-green-700 dark:bg-green-600"
                />
            </View>

            <OrderLineList
                lines={order.lines ?? []}
                onEdit={editor.setEditingLine}
                onAddService={editor.setServicingLine}
                onAddUpcharge={editor.setUpchargingLine}
                onReorder={editor.reorderLines}
                onRemove={editor.setRemovingLine}
                onQuantity={editor.changeQuantity}
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
                onSave={editor.saveOrder}
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
                    onSelect={selectDraft}
                    onNew={newDraft}
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
                <ScrollView
                    className="flex-1"
                    contentContainerClassName="p-3 sm:p-4"
                    refreshControl={refresh}
                >
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
                    <GlassPanel
                        className="rounded-2xl p-3 raised-lg"
                        fallbackClassName="bg-white dark:bg-zinc-800"
                    >
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
                                    onClick={sendToCheckout}
                                    loading={submitting}
                                    disabled={sendBlock !== undefined}
                                    title={sendBlock}
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
                        await editor.saveOrder(changes);
                        setFormVersion((value) => value + 1);
                    }}
                    onClose={() => setShowCustomerSheet(false)}
                />
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

            {discardingDraft && (
                <ConfirmationModal
                    title="Discard draft"
                    message={`Discard ${
                        order?.orderNumber ? `order #${order.orderNumber}` : "this order"
                    }? This cannot be undone.`}
                    confirmText="Discard"
                    destructive
                    onConfirm={discardDraft}
                    onCancel={() => setDiscardingDraft(false)}
                />
            )}
        </Page>
    );
};

export default SalesPage;
