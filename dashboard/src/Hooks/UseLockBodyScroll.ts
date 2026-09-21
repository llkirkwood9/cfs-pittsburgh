import { useEffect } from "react";

/**
 * Freezes the page behind a full-screen sheet or modal. Without this a customer dragging through
 * the address form on a tablet scrolls the order screen underneath, and closing the sheet leaves
 * the rep somewhere they did not expect.
 */
export const useLockBodyScroll = (): void => {
    useEffect(() => {
        const { overflow } = document.body.style;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = overflow;
        };
    }, []);
};
