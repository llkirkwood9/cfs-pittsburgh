import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export type ToastKind = "success" | "error" | "warning" | "info";

export type ToastMessage = {
    id: number;
    kind: ToastKind;
    message: string;
};

type Listener = (toasts: ToastMessage[]) => void;

/** How long a toast stays up, as on the dashboard. */
const DURATION_MS = 3000;

let toasts: ToastMessage[] = [];
let nextId = 1;
let listeners: Listener[] = [];

const publish = () => listeners.forEach((listener) => listener(toasts));

/**
 * Takes a toast down early, when it is tapped.
 * @param id The toast.
 */
export const DismissToast = (id: number): void => {
    toasts = toasts.filter((t) => t.id !== id);
    publish();
};

/**
 * Subscribes to the toasts on screen; the ToastHost draws them.
 * @param listener Called with the current toasts.
 * @returns An unsubscribe function.
 */
export const SubscribeToasts = (listener: Listener): (() => void) => {
    listeners.push(listener);
    listener(toasts);
    return () => {
        listeners = listeners.filter((l) => l !== listener);
    };
};

const haptic: Record<ToastKind, Haptics.NotificationFeedbackType | null> = {
    success: Haptics.NotificationFeedbackType.Success,
    error: Haptics.NotificationFeedbackType.Error,
    warning: Haptics.NotificationFeedbackType.Warning,
    info: null,
};

const show = (kind: ToastKind, message: string) => {
    const toast = { id: nextId++, kind, message };
    // Newest on top, and no more than four at once so the screen never fills with them.
    toasts = [toast, ...toasts].slice(0, 4);
    publish();
    setTimeout(() => DismissToast(toast.id), DURATION_MS);

    // A tap of feedback in the hand, so a rep looking at the customer still knows it worked.
    const feedback = haptic[kind];
    if (feedback !== null && Platform.OS !== "web")
        Haptics.notificationAsync(feedback).catch(() => undefined);
};

export const Toast = {
    /**
     * Shows a success toast.
     * @param message Text to show.
     */
    Success: (message: string) => show("success", message),

    /**
     * Shows an error toast.
     * @param message Text to show.
     */
    Error: (message: string) => show("error", message),

    /**
     * Shows a warning toast.
     * @param message Text to show.
     */
    Warning: (message: string) => show("warning", message),

    /**
     * Shows an informational toast.
     * @param message Text to show.
     */
    Info: (message: string) => show("info", message),
};
