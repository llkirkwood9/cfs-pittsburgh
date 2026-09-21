import type { ReactNode } from "react";
import Icon from "./Icon";
import { useLockBodyScroll } from "../../Hooks/UseLockBodyScroll";

type Props = {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
};

/**
 * Overlay sheet. On a phone it fills the screen and on a tablet it centres as a card, because a
 * small centred dialog is hard to work in with a thumb.
 */
const Modal = ({ title, onClose, children, footer, wide = false }: Props) => {
    useLockBodyScroll();

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl
                    sm:rounded-2xl dark:bg-zinc-800 ${wide ? "sm:max-w-4xl" : "sm:max-w-lg"}`}
            >
                <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-500
                            hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                        <Icon icon="fa-solid fa-xmark" className="text-xl" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

                {footer && (
                    <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-700">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
