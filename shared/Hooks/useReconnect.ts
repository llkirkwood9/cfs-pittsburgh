import { useEffect, useState } from "react";
import { api, foreground, Toast } from "@host";
import { IsOnline, OnConnectionChange, SetOnline } from "../Lib/Connection";

/** How often to check whether the server is back. */
const RETRY_MS = 5000;

/** How long one check waits for the server. */
const CHECK_TIMEOUT_MS = 4000;

/**
 * Whether the server can be reached, for the connection banner. While it cannot, this checks
 * every few seconds - and at once when the screen comes back to the front - and says so when the
 * server answers again.
 * @returns True while the server can be reached.
 */
export const useReconnect = (): boolean => {
    const [online, setOnline] = useState<boolean>(IsOnline());

    useEffect(() => OnConnectionChange(setOnline), []);

    useEffect(() => {
        if (online) return;

        const check = () => {
            api.get("/health", { timeout: CHECK_TIMEOUT_MS })
                .then(() => {
                    SetOnline(true);
                    Toast.Success("Reconnected to the server.");
                })
                .catch(() => undefined);
        };

        const timer = setInterval(check, RETRY_MS);
        const stopListening = foreground.onReturn(check);
        return () => {
            clearInterval(timer);
            stopListening();
        };
    }, [online]);

    return online;
};
