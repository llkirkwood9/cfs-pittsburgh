import { useWindowDimensions } from "react-native";

/** Tailwind's breakpoints, which the dashboard's layouts are written against. */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 } as const;

export type Breakpoint = "base" | keyof typeof BREAKPOINTS;

/** A value per breakpoint, like the dashboard's "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4". */
export type Responsive<T> = T | Partial<Record<Breakpoint, T>>;

/**
 * Which of the dashboard's breakpoints the screen is past, from the window width - an iPad in
 * landscape is "lg", an iPhone is "base".
 * @returns Flags for each breakpoint, and a resolver for responsive values.
 */
export const useBreakpoint = () => {
    const { width } = useWindowDimensions();

    const at = {
        sm: width >= BREAKPOINTS.sm,
        md: width >= BREAKPOINTS.md,
        lg: width >= BREAKPOINTS.lg,
        xl: width >= BREAKPOINTS.xl,
        "2xl": width >= BREAKPOINTS["2xl"],
    };

    /**
     * Picks the value for the current width: the largest breakpoint given that the screen is past.
     * @param value A plain value, or values per breakpoint.
     * @returns The value that applies now.
     */
    const pick = <T>(value: Responsive<T>): T => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) return value as T;
        const map = value as Partial<Record<Breakpoint, T>>;
        const order: Breakpoint[] = ["2xl", "xl", "lg", "md", "sm"];
        for (const bp of order) {
            if (at[bp as keyof typeof at] && map[bp] !== undefined) return map[bp] as T;
        }
        return map.base as T;
    };

    return { width, ...at, pick };
};
