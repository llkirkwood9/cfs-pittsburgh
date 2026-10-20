import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { DimensionValue, StyleProp, TextStyle, ViewStyle } from "react-native";

/**
 * The building blocks of the printed sheets - the sales sheet, the stat sheet, the inventory sheet
 * - which are copies of paper forms: black on white with hard ruled borders, whatever the app's
 * theme. React Native has no tables, so a sheet is rows of cells; each cell overlaps its
 * neighbours' borders by a point, so two cells share one line as table borders collapse.
 */

/** The serif the paper forms' small print is set in. */
export const SERIF = Platform.select({ ios: "Times New Roman", android: "serif", default: "serif" });

type CellProps = {
    children?: ReactNode;
    /** Width as a percentage of the row, like the dashboard's w-[14%]. */
    width?: DimensionValue;
    /** Grow to fill what is left of the row. */
    flex?: number;
    height?: number;
    align?: "left" | "center" | "right";
    /** Centre the content vertically, for compact item rows. */
    middle?: boolean;
    padded?: boolean;
    style?: StyleProp<ViewStyle>;
};

/** One ruled cell. */
export const Cell = ({
    children,
    width,
    flex,
    height,
    align = "left",
    middle = false,
    padded = true,
    style,
}: CellProps) => (
    <View
        style={[
            styles.cell,
            padded && styles.padded,
            width !== undefined && { width },
            flex !== undefined && { flex },
            height !== undefined && { minHeight: height },
            middle && { justifyContent: "center" },
            {
                alignItems:
                    align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
            },
            style,
        ]}
    >
        {children}
    </View>
);

/** A row of cells. */
export const Row = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
    <View style={[styles.row, style]}>{children}</View>
);

type SheetTextProps = {
    children?: ReactNode;
    size?: number;
    bold?: boolean;
    semibold?: boolean;
    italic?: boolean;
    color?: string;
    align?: "left" | "center" | "right";
    serif?: boolean;
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
};

/** Text on a sheet: black, a fixed size in points, never themed. */
export const SheetText = ({
    children,
    size = 10,
    bold = false,
    semibold = false,
    italic = false,
    color = "#000",
    align,
    serif = false,
    style,
    numberOfLines,
}: SheetTextProps) => (
    <Text
        numberOfLines={numberOfLines}
        style={[
            {
                fontSize: size,
                color,
                lineHeight: Math.round(size * 1.25),
                fontWeight: bold ? "700" : semibold ? "600" : "400",
                fontStyle: italic ? "italic" : "normal",
                textAlign: align,
                fontFamily: serif ? SERIF : undefined,
            },
            style,
        ]}
    >
        {children}
    </Text>
);

/** The small bold capitals a field is labelled with on the paper form ("NAME:"). */
export const FieldLabel = ({ children }: { children: string }) => (
    <Text style={styles.label}>{children} </Text>
);

/**
 * A blank to write on, e.g. the INITIAL line: the value underlined, or a run of underlined
 * spaces when there is none.
 */
export const Blank = ({ value, min = 6 }: { value?: string | null; min?: number }) => {
    const text = value ?? "";
    const pad = " ".repeat(Math.max(1, Math.ceil((min - text.length) / 2)));
    return (
        <Text style={styles.blank}>
            {pad}
            {text}
            {pad}
        </Text>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        // Each cell overlaps the one to its left and the row above by a point. The row only makes
        // up the horizontal overlap; the vertical one is what collapses two rows into one line.
        marginLeft: 1,
    },
    cell: {
        borderWidth: 1,
        borderColor: "#000",
        marginLeft: -1,
        marginTop: -1,
        backgroundColor: "transparent",
    },
    padded: {
        paddingHorizontal: 3,
        paddingVertical: 2,
    },
    label: {
        fontSize: 8,
        fontWeight: "700",
        textTransform: "uppercase",
        color: "#000",
    },
    blank: {
        textDecorationLine: "underline",
        fontWeight: "400",
        color: "#000",
    },
});
