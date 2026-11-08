import { useState } from "react";
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
import { useSalesFloor } from "@shared/Hooks/useSalesFloor";
import { FormatCurrency } from "@shared/Lib/Format";
import { SendToCheckoutBlock } from "@shared/Lib/Sales";

/**
 * The sales floor. A rep keeps as many drafts open as they have customers, builds each one from
 * the catalog, then hands it to the checkout table with one button.
 */
const SalesPage = () => {
    const [pane, setPane] = useState<"items" | "customer">("items");
    const [showCustomerSheet, setShowCustomerSheet] = useState<boolean>(false);

    // Bumped only when the customer sheet writes back, which remounts the rep's form so it picks
    // up what the customer typed. Keying on updatedAt instead would remount on every blur-save
    // and pull focus out of the field the rep just moved into.
    const [formVersion, setFormVersion] = useState<number>(0);

    const {
        saleEvent,
        products,
        deliveryOptions,
        reps,
        drafts,
        order,
        loading,
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

    if (loading) {
        return (
            <div className="mx-auto max-w-(--breakpoint-2xl) p-4">
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
                    A manager can activate one under Events.
                </p>
            </div>
        );
    }

    const sendBlock = order ? SendToCheckoutBlock(order) : undefined;

    return (
        <div className="mx-auto max-w-(--breakpoint-2xl) p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="text-xl font-bold">{saleEvent.organization}</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {drafts.length} open order{drafts.length === 1 ? "" : "s"}
                </p>
            </div>

            <DraftTabs
                drafts={drafts}
                activeId={order?.id ?? null}
                onSelect={selectDraft}
                onNew={newDraft}
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
                                        {order.orderNumber
                                            ? `Order #${order.orderNumber}`
                                            : "New order"}
                                    </span>
                                </h2>
                                <Button
                                    text="Add item"
                                    icon="fa-solid fa-plus"
                                    onClick={editor.openAddItem}
                                    className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                                />
                            </div>

                            <OrderLineList
                                lines={order.lines ?? []}
                                onEdit={editor.setEditingLine}
                                onAddService={editor.setServicingLine}
                                onAddUpcharge={editor.setUpchargingLine}
                                onReorder={editor.reorderLines}
                                onRemove={editor.setRemovingLine}
                                onQuantity={editor.changeQuantity}
                            />
                        </section>

                        <section
                            className={`lg:col-span-2 ${pane === "customer" ? "" : "hidden lg:block"}`}
                        >
                            <div className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
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
                            </div>
                        </section>
                    </div>

                    {/* Sticky action bar: the total and the hand-off button never scroll away. */}
                    <div className="sticky bottom-20 z-30 mt-4 rounded-2xl bg-white p-3 shadow-lg md:bottom-4 dark:bg-zinc-800">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="min-w-40 flex-1">
                                <OrderTotals order={order} compact />
                            </div>
                            <div className="flex w-full gap-2 sm:w-auto">
                                <Button
                                    text="Discard"
                                    icon="fa-solid fa-trash"
                                    onClick={() => setDiscardingDraft(true)}
                                    className="min-h-[52px]! flex-col gap-0.5! px-1! text-xs! sm:flex-row sm:gap-2! sm:px-5! sm:text-base! bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
                                />
                                <Button
                                    text={`Complete ${FormatCurrency(order.total)}`}
                                    icon="fa-solid fa-circle-check"
                                    onClick={sendToCheckout}
                                    loading={submitting}
                                    disabled={sendBlock !== undefined}
                                    title={sendBlock}
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
        </div>
    );
};

export default SalesPage;
