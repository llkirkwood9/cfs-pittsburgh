import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import { FormatCurrency } from "../../Lib/ModelHelpers";
import type { OrderSummary } from "../../Models/OrderSummary";

type Props = {
    drafts: OrderSummary[];
    activeId: number | null;
    onSelect: (id: number) => void;
    onNew: () => void;
    creating?: boolean;
};

/**
 * Horizontal switcher across the rep's open drafts. This is what makes several customers at once
 * workable: each customer is a tab, and switching never loses anything because every change is
 * already saved server-side.
 */
const DraftTabs = ({ drafts, activeId, onSelect, onNew, creating = false }: Props) => {
    return (
        <div className="flex items-center gap-2">
            <div className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-1">
                {drafts.map((draft) => {
                    const active = draft.id === activeId;
                    const label = draft.draftLabel || draft.billingName || `#${draft.orderNumber}`;

                    return (
                        <button
                            key={draft.id}
                            type="button"
                            onClick={() => draft.id && onSelect(draft.id)}
                            className={`flex min-h-[56px] shrink-0 flex-col items-start justify-center rounded-xl
                                px-4 text-left transition-colors ${
                                    active
                                        ? "bg-sky-700 text-white dark:bg-sky-600"
                                        : "bg-white text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                                }`}
                        >
                            <span className="max-w-[16ch] truncate text-sm font-semibold">
                                {label}
                            </span>
                            <span className="text-xs opacity-80">
                                #{draft.orderNumber} &middot; {draft.lineCount ?? 0} item
                                {(draft.lineCount ?? 0) === 1 ? "" : "s"} &middot;{" "}
                                {FormatCurrency(draft.total)}
                            </span>
                        </button>
                    );
                })}

                {drafts.length === 0 && (
                    <p className="flex min-h-[56px] items-center text-sm text-zinc-500 dark:text-zinc-400">
                        <Icon icon="fa-solid fa-arrow-right" className="mr-2" />
                        Start an order to begin
                    </p>
                )}
            </div>

            <Button
                text="New"
                icon="fa-solid fa-plus"
                onClick={onNew}
                loading={creating}
                className="shrink-0 bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
            />
        </div>
    );
};

export default DraftTabs;
