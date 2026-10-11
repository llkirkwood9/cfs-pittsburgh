import { Children, isValidElement, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { View } from "react-native";
import { useBreakpoint } from "../../Hooks/UseBreakpoint";
import type { Responsive } from "../../Hooks/UseBreakpoint";
import { cx } from "../../Lib/ClassNames";

type CellProps = {
    children?: ReactNode;
    /** Columns this cell spans, like col-span-2; a responsive value per breakpoint. */
    span?: Responsive<number>;
    className?: string;
};

/**
 * One cell of a Grid. Takes the place of a grid item's col-span-* classes.
 */
export const Cell = ({ children, className }: CellProps) => (
    <View className={className}>{children}</View>
);

type Props = {
    children: ReactNode;
    /** Columns, like grid-cols-*: a number, or a number per breakpoint. */
    columns: Responsive<number>;
    /** The gap between cells, in points (gap-3 is 12). */
    gap?: number;
    className?: string;
};

/**
 * The dashboard's CSS grids, for React Native: cells wrap into the given number of columns, with
 * the same breakpoints. A child that isn't a Cell spans one column.
 */
const Grid = ({ children, columns, gap = 12, className = "" }: Props) => {
    const { pick } = useBreakpoint();
    const [width, setWidth] = useState<number>(0);
    const cols = Math.max(1, pick(columns));
    // A point short of the full width, so rounding in the measured width never pushes the last
    // cell of a row onto the next.
    const unit = width > 0 ? Math.floor(((width - 1 - gap * (cols - 1)) / cols) * 100) / 100 : 0;

    return (
        <View
            className={cx("flex-row flex-wrap", className)}
            style={{ columnGap: gap, rowGap: gap }}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        >
            {Children.toArray(children).map((child, index) => {
                const span = isValidElement(child)
                    ? Math.min(cols, pick((child as ReactElement<CellProps>).props.span ?? 1))
                    : 1;
                return (
                    <View
                        key={isValidElement(child) && child.key ? child.key : index}
                        style={{
                            width:
                                width > 0
                                    ? unit * span + gap * (span - 1)
                                    : `${(100 / cols) * span}%`,
                        }}
                    >
                        {child}
                    </View>
                );
            })}
        </View>
    );
};

export default Grid;
