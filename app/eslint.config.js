const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
    expoConfig,
    {
        ignores: ["dist/*", ".expo/*", "node_modules/*"],
    },
    {
        rules: {
            // As on the dashboard: screens load data with plain useEffect + useState rather than a
            // query library, which this rule flags wholesale. The loads are guarded and idempotent.
            "react-hooks/set-state-in-effect": "off",
        },
    },
]);
