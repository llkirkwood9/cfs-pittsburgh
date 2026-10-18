import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

/**
 * Reloads a screen whenever it comes back into view - switching back to its tab, or back from a
 * screen opened over it - so nothing shown is older than the last visit. Quietly, without the pull
 * to refresh spinner. The first time the screen opens is left to its own loading.
 * @param refresh Reloads the screen's data.
 */
export const useRefreshOnFocus = (refresh: () => unknown): void => {
    const latest = useRef(refresh);
    useEffect(() => {
        latest.current = refresh;
    });
    const seen = useRef<boolean>(false);
    const running = useRef<boolean>(false);

    useFocusEffect(
        useCallback(() => {
            if (!seen.current) {
                seen.current = true;
                return;
            }
            // Flicking between tabs doesn't stack up reloads.
            if (running.current) return;
            running.current = true;
            Promise.resolve(latest.current()).finally(() => {
                running.current = false;
            });
        }, [])
    );
};
