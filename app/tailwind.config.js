const plugin = require("tailwindcss/plugin");

/**
 * Shadows and tabular-nums without CSS variables. NativeWind's shadow-* classes set
 * --tw-shadow-color, and a component whose classes start setting a variable after its first
 * render - a card that React reuses in place of a plain view, say - is remounted with a dev-only
 * warning that crashes under Expo Router ("Couldn't find a navigation context"). These draw the
 * same shadows with the colour written in, so the app uses raised-* where the dashboard uses
 * shadow-*. No class the app uses should set a variable.
 */
const raised = plugin(({ addUtilities }) => {
    const os = process.env.NATIVEWIND_OS;
    const native = os !== undefined && os !== "web";
    const color = "rgba(0, 0, 0, 0.35)";
    // Vertical offset, blur and Android elevation, as NativeWind's own shadow-* sizes.
    const sizes = {
        sm: [1, 1, 1],
        DEFAULT: [1, 4, 3],
        md: [3, 10, 6],
        lg: [4, 10, 8],
        xl: [6, 19, 13],
        "2xl": [12, 38, 24],
    };

    const utilities = {};
    for (const [size, [y, blur, elevation]] of Object.entries(sizes)) {
        const name = size === "DEFAULT" ? ".raised" : `.raised-${size}`;
        utilities[name] = native
            ? {
                  "-rn-shadow-color": color,
                  "@rn-move -rn-shadow-offset-width \\&shadow-offset\\.width": "true",
                  "-rn-shadow-offset-width": "0px",
                  "@rn-move -rn-shadow-offset-height \\&shadow-offset\\.height": "true",
                  "-rn-shadow-offset-height": `${y}px`,
                  "-rn-shadow-radius": `${blur}px`,
                  "-rn-shadow-opacity": "1",
                  ...(os === "android" ? { "-rn-elevation": String(elevation) } : {}),
              }
            : { "box-shadow": `0px ${y}px ${blur}px ${color}` };
    }
    // Tailwind's tabular-nums sets variables too, so that it can be combined with ordinal and
    // the like, which the app never uses.
    utilities[".tabular-nums"] = native
        ? { "-rn-font-variant": "tabular-nums" }
        : { "font-variant-numeric": "tabular-nums" };
    addUtilities(utilities);
});

/** @type {import('tailwindcss').Config} */
module.exports = {
    // The same Tailwind setup as the dashboard, so class names read the same in both.
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    darkMode: "class",
    presets: [require("nativewind/preset")],
    theme: {
        extend: {},
    },
    // Replaced by the variable-free tabular-nums above.
    corePlugins: { fontVariantNumeric: false },
    plugins: [raised],
};
