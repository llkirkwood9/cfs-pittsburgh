import { useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { IsOnline, OnConnectionChange } from "../../Lib/Connection";

/**
 * White status bar text - the time, signal and battery - for a screen whose top is dark whatever
 * the theme: the menu bar on every tab, and the blue band on the customer's sheets. Only the screen
 * in front sets it, so a screen pushed on top with a light header goes back to the theme's own.
 * While the amber connection banner covers the top, the banner sets it instead.
 */
const LightStatusBar = () => {
    const focused = useIsFocused();
    const [online, setOnline] = useState<boolean>(IsOnline());

    useEffect(() => OnConnectionChange(setOnline), []);

    return focused && online ? <StatusBar style="light" /> : null;
};

export default LightStatusBar;
