/** Light, dark, or following the device. */
export type Theme = "light" | "dark" | "system";

/** The choices, in the order the theme button cycles through them, with their names and icons. */
export const ThemeChoices: { value: Theme; label: string; icon: string }[] = [
    { value: "light", label: "Light", icon: "fa-solid fa-sun" },
    { value: "dark", label: "Dark", icon: "fa-solid fa-moon" },
    { value: "system", label: "System", icon: "fa-solid fa-circle-half-stroke" },
];

/**
 * The choice after this one, for a button that cycles through them.
 * @param theme The current choice.
 * @returns The next one.
 */
export const NextTheme = (theme: Theme): Theme => {
    const index = ThemeChoices.findIndex((choice) => choice.value === theme);
    return ThemeChoices[(index + 1) % ThemeChoices.length].value;
};

/**
 * The icon for a choice.
 * @param theme The choice.
 * @returns Its icon.
 */
export const ThemeIcon = (theme: Theme): string =>
    ThemeChoices.find((choice) => choice.value === theme)!.icon;
