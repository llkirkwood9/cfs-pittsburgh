type Props = {
    rows?: number;
};

/**
 * Placeholder rows shown while a list loads, so the layout does not jump on a slow cart wifi.
 */
const ListSkeleton = ({ rows = 4 }: Props) => {
    return (
        <ul className="space-y-2">
            {Array.from({ length: rows }).map((_, index) => (
                <li
                    key={index}
                    className="h-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700"
                />
            ))}
        </ul>
    );
};

export default ListSkeleton;
