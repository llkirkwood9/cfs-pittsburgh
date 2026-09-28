import { useEffect, useState } from "react";
import Icon from "./Icon";
import api from "../../Lib/api";
import { IsOnline, OnConnectionChange, SetOnline } from "../../Lib/Connection";
import { Toast } from "../../Lib/Toast";

/** How often to check whether the server is back. */
const RETRY_MS = 5000;

/**
 * A strip across the top of the screen while the server cannot be reached - usually the cart's
 * Wi-Fi dropping out. It checks every few seconds and disappears on its own once the server
 * answers again, so the crew knows to wait rather than keep re-entering things that did not save.
 */
const ConnectionBanner = () => {
    const [online, setOnline] = useState<boolean>(IsOnline());

    useEffect(() => OnConnectionChange(setOnline), []);

    useEffect(() => {
        if (online) return;

        const check = () => {
            api.get("/health", { timeout: 4000 })
                .then(() => {
                    SetOnline(true);
                    Toast.Success("Reconnected to the server.");
                })
                .catch(() => undefined);
        };

        const timer = setInterval(check, RETRY_MS);
        window.addEventListener("online", check);
        return () => {
            clearInterval(timer);
            window.removeEventListener("online", check);
        };
    }, [online]);

    if (online) return null;

    return (
        <div
            role="status"
            // Sits just under the menu bar and lets taps through, so the crew can still move
            // between screens while it waits for the server.
            className="no-print pointer-events-none fixed inset-x-0 top-16 z-[60] flex items-center justify-center
                gap-2 bg-amber-500 px-3 py-2 text-center text-sm font-semibold text-amber-950 shadow-lg"
        >
            <Icon icon="fa-solid fa-wifi" className="shrink-0" />
            <span>
                Can&apos;t reach the server - retrying. Changes won&apos;t save until it&apos;s
                back.
            </span>
            <Icon icon="fa-solid fa-circle-notch" spin className="shrink-0" />
        </div>
    );
};

export default ConnectionBanner;
