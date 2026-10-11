import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Button from "../Components/Elements/Button";
import Grid from "../Components/Elements/Grid";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import Page from "../Components/Elements/Page";
import TabButton from "../Components/Elements/TabButton";
import Text from "../Components/Elements/Text";
import TextField from "../Components/Elements/TextField";
import InventoryNotesEditor from "../Components/Inventory/InventoryNotesEditor";
import { useSettings } from "../Context/SettingsContext";
import { cx } from "../Lib/ClassNames";
import { IsOnline } from "../Lib/Connection";
import {
    CategoryNames,
    FormatDateTime,
    FormatTime,
    GroupInventory,
    InventoryRowKey,
    InventorySizeLabel,
} from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import type { Event } from "../Models/Event";
import type { InventoryAdjustment } from "../Models/InventoryAdjustment";
import type { InventoryItem } from "../Models/InventoryItem";
import type { ProductCategory } from "../Models/Product";
import { GetActiveEvent } from "../Services/EventServices";
import { AdjustInventory, GetInventory, GetInventoryHistory } from "../Services/InventoryServices";

const kindLabels: Record<string, string> = {
    Adjustment: "Count changed",
    Sale: "Take With sale",
    Return: "Returned to stock",
    Count: "End-of-event count",
    OpeningCount: "Start-of-event count",
};

/**
 * On-hand stock for the accessories kept at the cart. The checkout team counts what arrives and
 * what is left; Take With sales come off automatically when an order is completed. Only products
 * marked Track inventory in the catalog appear here.
 */
const InventoryPage = () => {
    // Counts at or below this show as running low; set under Settings.
    const {
        settings: { lowStockAt: LOW_STOCK },
    } = useSettings();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [search, setSearch] = useState<string>("");
    const [tab, setTab] = useState<ProductCategory | "All">("All");
    const [busyId, setBusyId] = useState<string | null>(null);

    const [counting, setCounting] = useState<InventoryItem | null>(null);
    const [countValue, setCountValue] = useState<string>("");
    const [countNote, setCountNote] = useState<string>("");
    const [savingCount, setSavingCount] = useState<boolean>(false);

    const [historyFor, setHistoryFor] = useState<InventoryItem | null>(null);
    const [history, setHistory] = useState<InventoryAdjustment[] | null>(null);

    const load = useCallback(async () => {
        const active = await GetActiveEvent();
        const rows = await GetInventory(active?.id ?? undefined);
        // A refresh that fails while the server cannot be reached keeps what is on screen.
        if (IsOnline()) {
            setSaleEvent(active);
            setItems(rows);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const replace = (updated: InventoryItem) =>
        setItems((current) =>
            current.map((i) =>
                InventoryRowKey(i) === InventoryRowKey(updated)
                    ? { ...i, quantityOnHand: updated.quantityOnHand, lastChangedAt: updated.lastChangedAt }
                    : i
            )
        );

    const nudge = async (item: InventoryItem, change: number) => {
        if (!item.productVariantId) return;
        setBusyId(InventoryRowKey(item));
        const updated = await AdjustInventory({
            productVariantId: item.productVariantId,
            stockKey: item.stockKey,
            change,
        });
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
            stockKey: counting.stockKey,
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
        setHistory(await GetInventoryHistory(item.productVariantId, item.stockKey));
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

    // When each of the event's shelf counts was last taken, and by whom.
    const latest = (
        at: (i: InventoryItem) => string | null | undefined,
        by: (i: InventoryItem) => string | null | undefined
    ) => {
        const row = items.filter((i) => at(i)).sort((a, b) => (at(b) ?? "").localeCompare(at(a) ?? ""))[0];
        return { at: row ? at(row) : null, by: row ? by(row) : null };
    };
    const opening = latest(
        (i) => i.openingCountedAt,
        (i) => i.openingCountedBy
    );
    const closing = latest(
        (i) => i.countedAt,
        (i) => i.countedBy
    );
    const countStatus = [
        {
            phase: "start",
            title: "Start-of-event count",
            hint: "Not done yet - count the shelf before the doors open",
            due: !opening.at,
            ...opening,
        },
        {
            phase: "end",
            title: "End-of-event count",
            hint: "Count what is left once the event is over",
            due: false,
            ...closing,
        },
    ];

    const outOfStock = items.filter((i) => (i.quantityOnHand ?? 0) <= 0).length;
    const totalUnits = items.reduce((sum, i) => sum + Math.max(0, i.quantityOnHand ?? 0), 0);

    if (loading) {
        return (
            <Page edges={["left", "right"]}>
                <ListSkeleton rows={6} />
            </Page>
        );
    }

    return (
        <Page edges={["left", "right"]} onRefresh={handleRefresh} refreshing={refreshing}>
            <View className="mx-auto w-full max-w-4xl">
                <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {totalUnits} units on hand
                    {outOfStock > 0 && (
                        <Text className="text-sm font-semibold text-red-700 dark:text-red-400">
                            {" "}
                            · {outOfStock} size{outOfStock === 1 ? "" : "s"} out of stock
                        </Text>
                    )}
                    . Take With sales come off automatically when checkout completes the order. Pull
                    down to refresh.
                </Text>

                {items.length > 0 && (
                    <Grid columns={{ base: 1, sm: 2 }} className="mb-5">
                        {countStatus.map((c) => (
                            <View
                                key={c.phase}
                                className={cx(
                                    "flex-row flex-wrap items-center gap-3 rounded-xl border-2 p-3",
                                    c.at
                                        ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                                        : c.due
                                          ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                                          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                                )}
                            >
                                <Icon
                                    icon={c.at ? "fa-solid fa-circle-check" : "fa-solid fa-clipboard-list"}
                                    className={cx(
                                        "text-xl",
                                        c.at
                                            ? "text-green-700 dark:text-green-400"
                                            : c.due
                                              ? "text-amber-700 dark:text-amber-400"
                                              : "text-zinc-400"
                                    )}
                                />
                                <View className="min-w-0 flex-1">
                                    <Text className="font-semibold">{c.title}</Text>
                                    <Text className="text-xs text-zinc-600 dark:text-zinc-400">
                                        {!saleEvent
                                            ? "Needs an active event"
                                            : c.at
                                              ? `Done ${FormatTime(c.at)}${c.by ? ` by ${c.by}` : ""}`
                                              : c.hint}
                                    </Text>
                                </View>
                                <Button
                                    text={c.at ? "Recount" : "Count now"}
                                    icon="fa-solid fa-clipboard-check"
                                    onClick={() =>
                                        router.push({
                                            pathname: "/more/inventory/count/[phase]",
                                            params: { phase: c.phase },
                                        })
                                    }
                                    disabled={!saleEvent}
                                    className={cx(
                                        "min-h-[44px] px-3 text-sm",
                                        c.at ? "bg-zinc-500 dark:bg-zinc-600" : "bg-green-700 dark:bg-green-600"
                                    )}
                                />
                            </View>
                        ))}
                    </Grid>
                )}

                {items.length > 0 && saleEvent?.id && (
                    <InventoryNotesEditor
                        eventId={saleEvent.id}
                        notes={saleEvent.inventoryNotes}
                        onSaved={(notes) =>
                            setSaleEvent((current) => (current ? { ...current, inventoryNotes: notes } : current))
                        }
                        className="mb-5"
                    />
                )}

                {items.length === 0 ? (
                    <View className="items-center rounded-xl border-2 border-dashed border-zinc-300 px-4 py-14 dark:border-zinc-700">
                        <Icon icon="fa-solid fa-boxes-stacked" className="text-3xl text-zinc-400" />
                        <Text className="mt-3 font-semibold">Nothing is being counted yet</Text>
                        <Text className="mt-1 max-w-sm text-center text-sm text-zinc-500 dark:text-zinc-400">
                            An administrator can turn on Track inventory for a product in the Catalog.
                        </Text>
                    </View>
                ) : (
                    <>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            className="mb-3"
                            contentContainerClassName="gap-2 pb-1"
                        >
                            <TabButton text="All" active={tab === "All"} onClick={() => setTab("All")} />
                            {categories.map((c) => (
                                <TabButton
                                    key={c}
                                    text={CategoryNames[c]}
                                    active={tab === c}
                                    onClick={() => setTab(c)}
                                />
                            ))}
                        </ScrollView>

                        <TextField
                            label="Search"
                            value={search}
                            onChange={setSearch}
                            placeholder="Product, brand or size"
                            className="mb-4"
                            autoCapitalize="none"
                        />

                        {groups.length === 0 && (
                            <Text className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                Nothing matches that search.
                            </Text>
                        )}

                        <View className="gap-6">
                            {groups.map((group) => (
                                <View key={group.category}>
                                    <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                        {CategoryNames[group.category]}
                                    </Text>

                                    <View className="gap-3">
                                        {group.products.map((product) => (
                                            <View
                                                key={product.productId}
                                                className="rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-800"
                                            >
                                                <Text className="mb-2 font-semibold">
                                                    {product.name}
                                                    <Text className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                                                        {"  "}
                                                        {product.brand}
                                                    </Text>
                                                </Text>

                                                {product.sizes.map((item, index) => {
                                                    const onHand = item.quantityOnHand ?? 0;
                                                    const busy = busyId === InventoryRowKey(item);

                                                    return (
                                                        <View
                                                            key={InventoryRowKey(item)}
                                                            className={cx(
                                                                "flex-row flex-wrap items-center gap-2 py-2",
                                                                index > 0 && "border-t border-zinc-100 dark:border-zinc-700"
                                                            )}
                                                        >
                                                            <View className="min-w-[112px] flex-1">
                                                                <Text className="font-medium">
                                                                    {InventorySizeLabel(item)}
                                                                </Text>
                                                                {onHand <= 0 ? (
                                                                    <Text className="text-xs font-semibold text-red-700 dark:text-red-400">
                                                                        Out of stock - ship only
                                                                    </Text>
                                                                ) : onHand <= LOW_STOCK ? (
                                                                    <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                                                        Running low
                                                                    </Text>
                                                                ) : null}
                                                            </View>

                                                            <View className="flex-row items-center gap-2">
                                                                <Button
                                                                    icon="fa-solid fa-minus"
                                                                    onClick={() => nudge(item, -1)}
                                                                    disabled={busy || onHand <= 0}
                                                                    title="Remove one"
                                                                    className="bg-zinc-500 px-4"
                                                                />
                                                                <Pressable
                                                                    onPress={() => openCount(item)}
                                                                    accessibilityRole="button"
                                                                    accessibilityLabel={`${onHand} on hand. Enter a count`}
                                                                    className="min-h-[48px] min-w-[72px] items-center justify-center rounded-xl px-3 active:bg-zinc-100 dark:active:bg-zinc-700"
                                                                >
                                                                    <Text
                                                                        className={cx(
                                                                            "text-xl font-bold tabular-nums",
                                                                            onHand <= 0 && "text-red-700 dark:text-red-400"
                                                                        )}
                                                                    >
                                                                        {onHand}
                                                                    </Text>
                                                                </Pressable>
                                                                <Button
                                                                    icon="fa-solid fa-plus"
                                                                    onClick={() => nudge(item, 1)}
                                                                    disabled={busy}
                                                                    title="Add one"
                                                                    className="bg-zinc-500 px-4"
                                                                />
                                                                <Pressable
                                                                    onPress={() => openHistory(item)}
                                                                    accessibilityRole="button"
                                                                    accessibilityLabel="History"
                                                                    className="h-12 w-12 items-center justify-center rounded-lg active:bg-zinc-100 dark:active:bg-zinc-700"
                                                                >
                                                                    <Icon
                                                                        icon="fa-solid fa-clock-rotate-left"
                                                                        className="text-zinc-500 dark:text-zinc-400"
                                                                    />
                                                                </Pressable>
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </>
                )}
            </View>

            {counting && (
                <Modal
                    title={`Count ${counting.productName} - ${InventorySizeLabel(counting)}`}
                    onClose={() => setCounting(null)}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={() => setCounting(null)}
                                className="bg-zinc-500 dark:bg-zinc-600"
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
                    <View className="gap-3">
                        <TextField
                            label="Number on hand"
                            value={countValue}
                            onChange={setCountValue}
                            inputMode="numeric"
                            autoFocus
                        />
                        <TextField
                            label="Note (optional)"
                            value={countNote}
                            onChange={setCountNote}
                            placeholder="e.g. Delivery received, end-of-event count"
                            maxLength={300}
                        />
                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                            Currently {counting.quantityOnHand ?? 0}. Saving records the change and
                            who made it.
                        </Text>
                    </View>
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
                        <Text className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            No changes recorded yet.
                        </Text>
                    ) : (
                        <View>
                            {history.map((row, index) => (
                                <View
                                    key={row.id}
                                    className={cx(
                                        "flex-row items-start gap-3 py-2",
                                        index > 0 && "border-t border-zinc-100 dark:border-zinc-700"
                                    )}
                                >
                                    <Text
                                        className={cx(
                                            "w-12 text-right text-sm font-bold tabular-nums",
                                            (row.change ?? 0) < 0
                                                ? "text-red-700 dark:text-red-400"
                                                : "text-green-700 dark:text-green-400"
                                        )}
                                    >
                                        {(row.change ?? 0) > 0 ? `+${row.change}` : row.change}
                                    </Text>
                                    <View className="min-w-0 flex-1">
                                        <Text className="text-sm">
                                            <Text className="text-sm font-medium">
                                                {kindLabels[row.kind ?? ""] ?? row.kind}
                                            </Text>
                                            {row.note ? (
                                                <Text className="text-sm text-zinc-600 dark:text-zinc-300">
                                                    {" "}
                                                    - {row.note}
                                                </Text>
                                            ) : null}
                                        </Text>
                                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {FormatDateTime(row.createdAt)}
                                            {row.userName ? ` - ${row.userName}` : ""}
                                        </Text>
                                    </View>
                                    <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {row.quantityAfter} left
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </Modal>
            )}
        </Page>
    );
};

export default InventoryPage;
