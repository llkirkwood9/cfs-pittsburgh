import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const rules = {
    // `any` is accepted pragmatically for FontAwesome icon props and loose event handlers.
    "@typescript-eslint/no-explicit-any": "off",
    "react-refresh/only-export-components": "off",
    // This project loads data with plain useEffect + useState rather than a query
    // library, which this rule flags wholesale. The loads are guarded and idempotent.
    "react-hooks/set-state-in-effect": "off",
};

/**
 * The code shared with the phone app (../shared), with the same rules. ../shared/eslint.config.js
 * uses it, so `npm run lint` lints both with this folder's plugins.
 */
export const sharedConfig = tseslint.config({
    extends: [
        js.configs.recommended,
        ...tseslint.configs.recommended,
        reactHooks.configs.flat["recommended-latest"],
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2020 },
    rules,
});

export default tseslint.config(
    { ignores: ["dist", "node_modules"] },
    {
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommended,
            reactHooks.configs.flat["recommended-latest"],
            reactRefresh.configs.vite,
        ],
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        rules,
    }
);
