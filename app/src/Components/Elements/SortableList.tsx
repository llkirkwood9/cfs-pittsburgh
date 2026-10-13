import type { ReactNode } from "react";
import Sortable from "react-native-sortables";

type Props<T> = {
    data: T[];
    keyExtractor: (item: T) => string;
    renderItem: (item: T, index: number) => ReactNode;
    /** Called with the items in their new order once one is dropped somewhere new. */
    onReorder: (items: T[]) => void;
    /** Off where the list can't be reordered, e.g. a finished order. */
    enabled?: boolean;
    /** Space between rows, in points. */
    gap?: number;
};

/**
 * A list whose rows can be put in a new order: hold a row for a moment, then drag it to its new
 * place. A quick tap or a swipe still reaches the row itself, so it can open or uncover its
 * actions as usual.
 */
function SortableList<T>({
    data,
    keyExtractor,
    renderItem,
    onReorder,
    enabled = true,
    gap = 8,
}: Props<T>) {
    return (
        <Sortable.Grid
            columns={1}
            data={data}
            keyExtractor={keyExtractor}
            renderItem={({ item, index }) => <>{renderItem(item, index)}</>}
            rowGap={gap}
            sortEnabled={enabled && data.length > 1}
            // Long enough that scrolling the page doesn't pick a row up.
            dragActivationDelay={300}
            activeItemScale={1.03}
            inactiveItemOpacity={0.6}
            overDrag="vertical"
            hapticsEnabled
            onDragEnd={({ data: reordered, fromIndex, toIndex }) => {
                if (fromIndex !== toIndex) onReorder(reordered);
            }}
        />
    );
}

export default SortableList;
