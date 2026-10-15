import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { IsOnline } from "../Lib/Connection";
import { GetActiveEvent } from "../Services/EventServices";

/**
 * Keeps a screen on the active event. Tabs stay loaded once opened, so a screen loaded before an
 * admin switched events would go on showing the old one; this checks again whenever the screen
 * comes back into view or the app comes back to the front, and reloads the screen if the active
 * event is not the one it loaded.
 * @param activeId The active event's id as the screen last loaded it: null for none, undefined
 * while it is still loading.
 * @param reload Loads the screen again.
 * @returns A check to run on demand, such as on pull to refresh; true when it reloaded.
 */
export const useActiveEventChange = (
    activeId: number | null | undefined,
    reload: () => void | Promise<void>
): (() => Promise<boolean>) => {
    const latest = useRef({ activeId, reload });
    useEffect(() => {
        latest.current = { activeId, reload };
    });
    const focused = useRef<boolean>(false);

    const check = useCallback(async (): Promise<boolean> => {
        if (latest.current.activeId === undefined) return false;
        const active = await GetActiveEvent();
        // No answer from the server says nothing about the event: keep what is on screen.
        if (!IsOnline()) return false;
        if ((active?.id ?? null) === latest.current.activeId) return false;
        await latest.current.reload();
        return true;
    }, []);

    useFocusEffect(
        useCallback(() => {
            focused.current = true;
            check();
            return () => {
                focused.current = false;
            };
        }, [check])
    );

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active" && focused.current) check();
        });
        return () => subscription.remove();
    }, [check]);

    return check;
};
