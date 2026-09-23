import { toast } from "react-toastify";
import type { ToastOptions } from "react-toastify";
import { getCurrentTheme } from "../Hooks/UseTheme";

/**
 * Builds the shared toast options, themed to match the app and sized for a tablet.
 * @returns Toast options.
 */
const options = (): ToastOptions => ({
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: getCurrentTheme(),
});

export const Toast = {
    /**
     * Shows a success toast.
     * @param message Text to show.
     */
    Success: (message: string) => toast.success(message, options()),

    /**
     * Shows an error toast.
     * @param message Text to show.
     */
    Error: (message: string) => toast.error(message, options()),

    /**
     * Shows a warning toast.
     * @param message Text to show.
     */
    Warning: (message: string) => toast.warning(message, options()),

    /**
     * Shows an informational toast.
     * @param message Text to show.
     */
    Info: (message: string) => toast.info(message, options()),
};
