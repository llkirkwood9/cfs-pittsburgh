import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import TextField from "../Components/Elements/TextField";
import { useAuth } from "../Context/AuthContext";
import {
    CategoryNames,
    GroupInventory,
    InventoryRowKey,
    InventorySizeLabel,
} from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import type { Event } from "../Models/Event";
import type { InventoryItem } from "../Models/InventoryItem";
import { GetActiveEvent } from "../Services/EventServices";
import { GetInventory, SaveInventoryCount } from "../Services/InventoryServices";

type Phase = "start" | "end";

/** The wording that differs between the two counts. */
const copy: Record<Phase, { title: string; intro: string; saved: string }> = {
    start: {
        title: "Start-of-event count",
        intro: "Count what is on the shelf before the doors open, including anything delivered today.",
        saved: "Start-of-event count saved",
    },
    end: {
        title: "End-of-event count",
        intro: "Count what is left on the shelf now that the event is over.",
        saved: "End-of-event count saved",
    },
};

/**
 * A shelf count for the active event: the start-of-event count before the doors open, or the
 * end-of-event count once they close. Checkout works down the list entering what is actually on
 * the shelf; saving sets every counted size to what was found and records the count against the
 * event, so the Accessory Inventory Sheet shows what the event started with, what the app expected
 * at the end and what was really left.
 */
const InventoryCountPage = () => {
    const navigate = useNavigate();
    const { hasRole } = useAuth();
    const params = useParams();
    const phase: Phase = params.phase === "start" ? "start" : "end";
    const text = copy[phase];

    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [counts, setCounts] = useState<Record<string, string>>({});
    const [note, setNote] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [confirming, setConfirming] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const active = await GetActiveEvent();
            setSaleEvent(active);
            if (active?.id) {
                const rows = await GetInventory(active.id);
                setItems(rows);
                // A count already taken at this event opens with its numbers, so it can be
                // corrected rather than started again.
                const previous = (r: InventoryItem) =>
                    phase === "start" ? r.openingCountAtEvent : r.countedAtEvent;
                setCounts(
                    Object.fromEntries(
                        rows
                            .filter((r) => previous(r) !== null && previous(r) !== undefined)
                            .map((r) => [InventoryRowKey(r), String(previous(r))])
                    )
                );
            }
            setLoading(false);
        };
        load();
    }, [phase]);

    const groups = useMemo(() => GroupInventory(items), [items]);

    const parse = (value: string | undefined): number | null => {
        if (value === undefined || value.trim() === "") return null;
        const n = Number(value);
        return Number.isInteger(n) && n >= 0 ? n : null;
    };

    const entered = items.filter((i) => parse(counts[InventoryRowKey(i)]) !== null);
    const invalid = items.some((i) => {
        const raw = counts[InventoryRowKey(i)];
        return raw !== undefined && raw.trim() !== "" && parse(raw) === null;
    });
    const differences = entered.filter(
        (i) => parse(counts[InventoryRowKey(i)]) !== (i.quantityOnHand ?? 0)
    );
    const blanks = items.length - entered.length;

    const setCount = (item: InventoryItem, value: string) =>
        setCounts((current) => ({
            ...current,
            [InventoryRowKey(item)]: value.replace(/[^0-9]/g, ""),
        }));

    // Fills every size not yet counted with what the app expects - for the common case where the
    // shelf agrees and only a few sizes need a real number.
    const fillBlanks = () =>
        setCounts((current) => {
            const next = { ...current };
            for (const item of items) {
                const id = InventoryRowKey(item);
                if (parse(next[id]) === null) next[id] = String(item.quantityOnHand ?? 0);
            }
            return next;
        });

    const save = async () => {
        if (!saleEvent?.id) return;

        setSaving(true);
        const result = await SaveInventoryCount({
            eventId: saleEvent.id,
            phase: phase === "start" ? "Start" : "End",
            note: note.trim() || undefined,
            counts: entered.map((i) => ({
                productVariantId: i.productVariantId ?? 0,
                stockKey: i.stockKey,
                counted: parse(counts[InventoryRowKey(i)]) ?? 0,
            })),
        });
        setSaving(false);
        setConfirming(false);

        if (!result) return;
        Toast.Success(
            `${text.saved} for ${entered.length} size${entered.length === 1 ? "" : "s"}.` +
                (differences.length ? ` ${differences.length} updated to match the shelf.` : "")
        );
        navigate("/inventory");
    };

    const review = () => {
        if (invalid) return Toast.Warning("Counts must be whole numbers, 0 or more.");
        if (entered.length === 0) return Toast.Warning("Enter at least one count.");
        setConfirming(true);
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-4xl p-4">
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
                    Shelf counts are saved against the active event. An administrator can activate
                    one under Events.
                </p>
                <Button
                    text="Back to inventory"
                    icon="fa-solid fa-arrow-left"
                    onClick={() => navigate("/inventory")}
                    className="mt-4 bg-zinc-500 hover:bg-zinc-600"
                />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl p-3 pb-28 sm:p-4 sm:pb-28">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">{text.title}</h1>
                <div className="flex flex-wrap gap-2">
                    {blanks > 0 && (
                        <Button
                            text="Fill the rest as matching"
                            icon="fa-solid fa-check-double"
                            onClick={fillBlanks}
                            className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                    )}
                    <Button
                        text="Back"
                        icon="fa-solid fa-arrow-left"
                        onClick={() => navigate("/inventory")}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                </div>
            </div>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                {saleEvent.organization}. {text.intro} Tap{" "}
                <span className="font-semibold">Matches</span> when the shelf agrees with the app.
                Leave a size blank to skip it.
            </p>

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
                                    className="rounded-xl bg-white p-3 shadow-xs dark:bg-zinc-800"
                                >
                                    <p className="mb-1 font-semibold">
                                        {product.name}
                                        <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                                            {product.brand}
                                        </span>
                                    </p>
                                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                                        {product.sizes.map((item) => {
                                            const id = InventoryRowKey(item);
                                            const expected = item.quantityOnHand ?? 0;
                                            const counted = parse(counts[id]);
                                            const diff =
                                                counted === null ? null : counted - expected;

                                            return (
                                                <li
                                                    key={id}
                                                    className="flex flex-wrap items-center gap-2 py-2"
                                                >
                                                    <div className="min-w-28 flex-1">
                                                        <p className="font-medium">
                                                            {InventorySizeLabel(item)}
                                                        </p>
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                            Expected {expected}
                                                            {diff !== null && (
                                                                <span
                                                                    className={`ml-2 font-semibold ${
                                                                        diff === 0
                                                                            ? "text-green-700 dark:text-green-400"
                                                                            : "text-amber-700 dark:text-amber-400"
                                                                    }`}
                                                                >
                                                                    {diff === 0
                                                                        ? "Matches"
                                                                        : `${diff > 0 ? "+" : ""}${diff}`}
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        text="Matches"
                                                        icon="fa-solid fa-check"
                                                        onClick={() =>
                                                            setCount(item, String(expected))
                                                        }
                                                        className="min-h-[44px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                                                    />
                                                    <input
                                                        value={counts[id] ?? ""}
                                                        onChange={(e) =>
                                                            setCount(item, e.target.value)
                                                        }
                                                        inputMode="numeric"
                                                        aria-label={`Counted ${product.name} ${InventorySizeLabel(item)}`}
                                                        placeholder="-"
                                                        className="min-h-[48px] w-20 rounded-xl border border-zinc-300 bg-white text-center text-xl
                                                            font-bold tabular-nums text-zinc-900 outline-hidden focus:border-sky-600
                                                            focus:ring-2 focus:ring-sky-600/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                                                    />
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                <TextField
                    label="Note (optional)"
                    value={note}
                    onChange={setNote}
                    placeholder={
                        phase === "start"
                            ? "e.g. Counted by Jamie, 6 queen protectors delivered this morning"
                            : "e.g. Counted by Jamie, one pillow kept as a floor sample"
                    }
                    maxLength={300}
                />
            </div>

            <div className="fixed inset-x-0 bottom-20 z-30 px-3 md:bottom-4">
                <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-lg dark:bg-zinc-800">
                    <p className="flex-1 text-sm">
                        <span className="font-bold">
                            {entered.length} of {items.length}
                        </span>{" "}
                        sizes counted
                        {differences.length > 0 && (
                            <span className="text-amber-700 dark:text-amber-400">
                                {" "}
                                &middot; {differences.length} differ
                            </span>
                        )}
                    </p>
                    <Button
                        text="Save count"
                        icon="fa-solid fa-clipboard-check"
                        onClick={review}
                        disabled={entered.length === 0}
                        className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                    />
                </div>
            </div>

            {confirming && (
                <ConfirmationModal
                    title={`Save the ${phase === "start" ? "start-of-event" : "end-of-event"} count`}
                    message={
                        `Save counts for ${entered.length} of ${items.length} sizes?` +
                        (differences.length
                            ? ` ${differences.length} differ from what the app expected and will be updated to match the shelf.`
                            : " Everything matches what the app expected.") +
                        (hasRole("Admin")
                            ? " The count prints on the event's Accessory Inventory Sheet."
                            : "")
                    }
                    confirmText={saving ? "Saving..." : "Save count"}
                    onConfirm={save}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </div>
    );
};

export default InventoryCountPage;
