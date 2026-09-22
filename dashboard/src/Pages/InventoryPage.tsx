import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import TabButton from "../Components/Elements/TabButton";
import TextField from "../Components/Elements/TextField";
import {
    CategoryNames,
    GroupInventory,
    InventorySizeLabel,
} from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import type { InventoryAdjustment } from "../Models/InventoryAdjustment";
import type { InventoryItem } from "../Models/InventoryItem";
import type { ProductCategory } from "../Models/Product";
import {
    AdjustInventory,
    GetInventory,
    GetInventoryHistory,
} from "../Services/InventoryServices";

/** Counts at or below this show as running low. */
const LOW_STOCK = 2;

/**
 * Formats a server timestamp, which is stored in UTC without a zone marker.
 * @param value ISO date string.
 * @returns A string such as "9/21/26, 2:14 PM".
 */
const formatWhen = (value?: string | null): string => {
    if (!value) return "";
    const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-US", {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

const kindLabels: Record<string, string> = {
    Adjustment: "Count changed",
    Sale: "Take With sale",
    Return: "Returned to stock",
};

/**
 * On-hand stock for the accessories kept at the cart. The checkout team counts what arrives and
 * what is left; Take With sales come off automatically when an order is completed. Only products
 * marked Track inventory in the catalog appear here.
 */
const InventoryPage = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [search, setSearch] = useState<string>("");
    const [tab, setTab] = useState<ProductCategory | "All">("All");
    const [busyId, setBusyId] = useState<number | null>(null);

    const [counting, setCounting] = useState<InventoryItem | null>(null);
    const [countValue, setCountValue] = useState<string>("");
    const [countNote, setCountNote] = useState<string>("");
    const [savingCount, setSavingCount] = useState<boolean>(false);

    const [historyFor, setHistoryFor] = useState<InventoryItem | null>(null);
    const [history, setHistory] = useState<InventoryAdjustment[] | null>(null);

    const load = useCallback(async () => {
        setItems(await GetInventory());
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const replace = (updated: InventoryItem) =>
        setItems((current) =>
            current.map((i) => (i.productVariantId === updated.productVariantId ? updated : i))
        );

    const nudge = async (item: InventoryItem, change: number) => {
        if (!item.productVariantId) return;
        setBusyId(item.productVariantId);
        const updated = await AdjustInventory({ productVariantId: item.productVariantId, change });
        setBusyId(null);
        if (updated) replace(updated);
    };

    const openCount = (item: InventoryItem) => {
        setCounting(item);
        setCountValue(String(item.quantityOnHand ?? 0));
        setCountNote("");
    };

    const saveCount = async () => {
        if (!counting?.productVariantId) return;

        const value = Number(countValue);
        if (!Number.isInteger(value) || value < 0)
            return Toast.Warning("Enter the number on hand - a whole number, 0 or more.");

        setSavingCount(true);
        const updated = await AdjustInventory({
            productVariantId: counting.productVariantId,
            setTo: value,
            note: countNote.trim() || undefined,
        });
        setSavingCount(false);

        if (!updated) return;
        replace(updated);
        setCounting(null);
        Toast.Success(`${counting.productName} (${InventorySizeLabel(counting)}) set to ${value}.`);
    };

    const openHistory = async (item: InventoryItem) => {
        if (!item.productVariantId) return;
        setHistoryFor(item);
        setHistory(null);
        setHistory(await GetInventoryHistory(item.productVariantId));
    };

    const categories = useMemo(
        () => Array.from(new Set(items.map((i) => i.category ?? "Misc"))) as ProductCategory[],
        [items]
    );

    const groups = useMemo(() => {
        const term = search.trim().toLowerCase();
        return GroupInventory(
            items.filter((i) => {
                if (tab !== "All" && i.category !== tab) return false;
                if (!term) return true;
                return (
                    (i.productName ?? "").toLowerCase().includes(term) ||
                    (i.brand ?? "").toLowerCase().includes(term) ||
                    (i.size ?? "").toLowerCase().includes(term)
                );
            })
        );
    }, [items, tab, search]);

    const outOfStock = items.filter((i) => (i.quantityOnHand ?? 0) <= 0).length;
    const totalUnits = items.reduce((sum, i) => sum + Math.max(0, i.quantityOnHand ?? 0), 0);

    if (loading) {
        return (
            <div className="mx-auto max-w-4xl p-4">
                <ListSkeleton rows={6} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl p-3 sm:p-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">Inventory</h1>
                <Button text="Refresh" icon="fa-solid fa-rotate" onClick={load} />
            </div>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                {totalUnits} units on hand
                {outOfStock > 0 && (
                    <span className="font-semibold text-red-700 dark:text-red-400">
                        {" "}
                        &middot; {outOfStock} size{outOfStock === 1 ? "" : "s"} out of stock
                    </span>
                )}
                . Take With sales come off automatically when checkout completes the order.
            </p>

            {items.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-zinc-300 py-14 text-center dark:border-zinc-700">
                    <Icon icon="fa-solid fa-boxes-stacked" className="text-3xl text-zinc-400" />
                    <p className="mt-3 text-base font-semibold">Nothing is being counted yet</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                        An administrator can turn on Track inventory for a product in the Catalog.
                    </p>
                </div>
            ) : (
                <>
                    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                        <TabButton text="All" active={tab === "All"} onClick={() => setTab("All")} />
                        {categories.map((c) => (
                            <TabButton
                                key={c}
                                text={CategoryNames[c]}
                                active={tab === c}
                                onClick={() => setTab(c)}
                            />
                        ))}
                    </div>

                    <TextField
                        label="Search"
                        value={search}
                        onChange={setSearch}
                        placeholder="Product, brand or size"
                        className="mb-4"
                    />

                    {groups.length === 0 && (
                        <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            Nothing matches that search.
                        </p>
                    )}

                    <div className="space-y-6">
                        {groups.map((group) => (
                            <section key={group.category}>
                                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    {CategoryNames[group.category]}
                                </h2>

                                <div className="space-y-3">
                                    {group.products.map((product) => (
                                        <div
                                            key={product.productId}
                                            className="rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-800"
                                        >
                                            <p className="mb-2 font-semibold">
                                                {product.name}
                                                <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                                                    {product.brand}
                                                </span>
                                            </p>

                                            <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                                                {product.sizes.map((item) => {
                                                    const onHand = item.quantityOnHand ?? 0;
                                                    const busy = busyId === item.productVariantId;

                                                    return (
                                                        <li
                                                            key={item.productVariantId}
                                                            className="flex flex-wrap items-center gap-2 py-2"
                                                        >
                                                            <div className="min-w-[7rem] flex-1">
                                                                <p className="font-medium">
                                                                    {InventorySizeLabel(item)}
                                                                </p>
                                                                {onHand <= 0 ? (
                                                                    <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                                                                        Out of stock - ship only
                                                                    </p>
                                                                ) : onHand <= LOW_STOCK ? (
                                                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                                                        Running low
                                                                    </p>
                                                                ) : null}
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    icon="fa-solid fa-minus"
                                                                    onClick={() => nudge(item, -1)}
                                                                    disabled={busy || onHand <= 0}
                                                                    title="Remove one"
                                                                    className="bg-zinc-500 px-4 hover:bg-zinc-600"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openCount(item)}
                                                                    title="Enter a count"
                                                                    className={`min-h-[48px] min-w-[4.5rem] rounded-xl px-3 text-xl font-bold tabular-nums
                                                                        transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                                                                            onHand <= 0
                                                                                ? "text-red-700 dark:text-red-400"
                                                                                : ""
                                                                        }`}
                                                                >
                                                                    {onHand}
                                                                </button>
                                                                <Button
                                                                    icon="fa-solid fa-plus"
                                                                    onClick={() => nudge(item, 1)}
                                                                    disabled={busy}
                                                                    title="Add one"
                                                                    className="bg-zinc-500 px-4 hover:bg-zinc-600"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openHistory(item)}
                                                                    aria-label="History"
                                                                    title="History"
                                                                    className="flex h-12 w-12 items-center justify-center rounded-lg text-zinc-500
                                                                        hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                                                >
                                                                    <Icon icon="fa-solid fa-clock-rotate-left" />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </>
            )}

            {counting && (
                <Modal
                    title={`Count ${counting.productName} - ${InventorySizeLabel(counting)}`}
                    onClose={() => setCounting(null)}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={() => setCounting(null)}
                                className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                            />
                            <Button
                                text="Save count"
                                icon="fa-solid fa-check"
                                onClick={saveCount}
                                loading={savingCount}
                            />
                        </>
                    }
                >
                    <div className="space-y-3">
                        <TextField
                            label="Number on hand"
                            value={countValue}
                            onChange={setCountValue}
                            inputMode="numeric"
                        />
                        <TextField
                            label="Note (optional)"
                            value={countNote}
                            onChange={setCountNote}
                            placeholder="e.g. Delivery received, end-of-event count"
                            maxLength={300}
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Currently {counting.quantityOnHand ?? 0}. Saving records the change and
                            who made it.
                        </p>
                    </div>
                </Modal>
            )}

            {historyFor && (
                <Modal
                    title={`${historyFor.productName} - ${InventorySizeLabel(historyFor)}`}
                    onClose={() => setHistoryFor(null)}
                >
                    {history === null ? (
                        <ListSkeleton rows={3} />
                    ) : history.length === 0 ? (
                        <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            No changes recorded yet.
                        </p>
                    ) : (
                        <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                            {history.map((row) => (
                                <li key={row.id} className="flex items-start gap-3 py-2 text-sm">
                                    <span
                                        className={`w-12 shrink-0 text-right font-bold tabular-nums ${
                                            (row.change ?? 0) < 0
                                                ? "text-red-700 dark:text-red-400"
                                                : "text-green-700 dark:text-green-400"
                                        }`}
                                    >
                                        {(row.change ?? 0) > 0 ? `+${row.change}` : row.change}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="font-medium">
                                            {kindLabels[row.kind ?? ""] ?? row.kind}
                                        </span>
                                        {row.note && (
                                            <span className="text-zinc-600 dark:text-zinc-300">
                                                {" "}
                                                - {row.note}
                                            </span>
                                        )}
                                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                            {formatWhen(row.createdAt)}
                                            {row.userName ? ` - ${row.userName}` : ""}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                                        {row.quantityAfter} left
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Modal>
            )}
        </div>
    );
};

export default InventoryPage;
