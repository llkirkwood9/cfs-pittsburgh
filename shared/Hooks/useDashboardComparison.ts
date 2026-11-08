import { useCallback, useEffect, useState } from "react";
import { IsOnline } from "../Lib/Connection";
import { ComparisonTotals, RangeDates } from "../Lib/Dashboard";
import type { ComparisonRange } from "../Lib/Dashboard";
import type { TerritoryStats } from "../Models/Territory";
import { GetTerritoryComparison } from "../Services/DashboardServices";

/**
 * Every territory's figures side by side over a chosen range, read again every few seconds.
 * @param pollMs Refresh interval in milliseconds.
 * @param refreshKey Changes to read the figures again at once (a pull to refresh).
 * @returns The range, the rows (null until read), their totals and the largest total.
 */
export const useDashboardComparison = (pollMs: number, refreshKey = 0) => {
    const [range, setRange] = useState<ComparisonRange>("today");
    const [rows, setRows] = useState<TerritoryStats[] | null>(null);

    const load = useCallback(async (which: ComparisonRange) => {
        const { from, to } = RangeDates(which);
        const result = await GetTerritoryComparison(from, to);
        // Keep the last figures up while the server can't be reached.
        if (result || IsOnline()) setRows(result ?? []);
    }, []);

    useEffect(() => {
        load(range);
        const timer = setInterval(() => load(range), pollMs);
        return () => clearInterval(timer);
    }, [range, load, pollMs, refreshKey]);

    return { range, setRange, rows, ...ComparisonTotals(rows ?? []) };
};
