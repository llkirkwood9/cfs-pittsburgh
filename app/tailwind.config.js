/** @type {import('tailwindcss').Config} */
module.exports = {
    // The same Tailwind setup as the dashboard, so class names read the same in both.
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    darkMode: "class",
    presets: [require("nativewind/preset")],
    theme: {
        extend: {},
    },
    plugins: [],
};
