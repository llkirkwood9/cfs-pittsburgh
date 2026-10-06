import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../Elements/Icon";
import SizeGuideModal from "../Elements/SizeGuideModal";

/**
 * Opens the mattress size chart from the menu bar, so anyone - on any screen, in any role - can
 * show a customer how the sizes compare.
 */
const SizeGuideButton = () => {
    const [open, setOpen] = useState<boolean>(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Mattress sizes"
                aria-label="Mattress sizes"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-200 hover:bg-white/10"
            >
                <Icon icon="fa-solid fa-ruler-combined" className="text-lg" />
            </button>
            {/* Drawn at the page root: inside the fixed menu bar it would sit under the phone's
                bottom tab bar. */}
            {open && createPortal(<SizeGuideModal onClose={() => setOpen(false)} />, document.body)}
        </>
    );
};

export default SizeGuideButton;
