import { useEffect, useState } from "react";
import { View } from "react-native";
import Button from "./Button";
import Spinner from "./Spinner";
import Text from "./Text";

/** How long the loading screen waits before offering a way out. */
const SIGN_OUT_AFTER_MS = 3000;

type Props = {
    /**
     * Offered after a few seconds, while the session is being restored, so a server that can't be
     * reached doesn't keep the crew member waiting.
     */
    onSignOut?: () => void;
};

/**
 * Full-screen loading state, shown while the session is being restored on app start.
 */
const LoadingPage = ({ onSignOut }: Props) => {
    const [slow, setSlow] = useState<boolean>(false);
    const [signingOut, setSigningOut] = useState<boolean>(false);

    const offerSignOut = Boolean(onSignOut);
    useEffect(() => {
        if (!offerSignOut) return;
        const timer = setTimeout(() => setSlow(true), SIGN_OUT_AFTER_MS);
        return () => clearTimeout(timer);
    }, [offerSignOut]);

    return (
        <View className="flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900">
            <View className="items-center gap-3">
                <Spinner size="large" />
                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                    {slow ? "Waiting for the server..." : "Loading..."}
                </Text>
                {slow && onSignOut && (
                    <Button
                        text="Sign out"
                        icon="fa-solid fa-right-from-bracket"
                        loading={signingOut}
                        onClick={() => {
                            setSigningOut(true);
                            onSignOut();
                        }}
                        className="mt-2 bg-zinc-500 dark:bg-zinc-600"
                    />
                )}
            </View>
        </View>
    );
};

export default LoadingPage;
