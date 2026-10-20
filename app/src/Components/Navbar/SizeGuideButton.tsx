import { useState } from "react";
import { Pressable } from "react-native";
import Icon from "../Elements/Icon";
import SizeGuideModal from "../Elements/SizeGuideModal";

/**
 * Opens the mattress size chart from the top bar, so anyone - on any screen, in any role - can
 * show a customer how the sizes compare.
 */
const SizeGuideButton = () => {
    const [open, setOpen] = useState<boolean>(false);

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Mattress sizes"
                className="h-11 w-11 items-center justify-center rounded-xl active:bg-white/10"
            >
                <Icon icon="fa-solid fa-ruler-combined" className="text-lg text-zinc-200" />
            </Pressable>
            {open && <SizeGuideModal onClose={() => setOpen(false)} />}
        </>
    );
};

export default SizeGuideButton;
