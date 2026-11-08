import { useCallback, useEffect, useState } from "react";
import { ComparisonTotals, DASHBOARD_POLL_MS, RangeDates } from "../Lib/Dashboard";
import type { ComparisonRange } from "../Lib/Dashboard";
import type { TerritoryStats } from "../Models/Territory";
import { GetTerritoryComparison } from "../Services/DashboardServices";

/**
 * Every territory's figures side by side over a chosen range, read again as often as the rest of
 * the dashboard.
 * @param refreshKey Changes to read the figures again at once (a pull to refresh).
 * @returns The range, the rows (null until read), their totals and the largest total.
 */
export const useDashboardComparison = (refreshKey = 0) => {
    const [range, setRange] = useState<ComparisonRange>("today");
    const [rows, setRows] = useState<TerritoryStats[] | null>(null);

    const load = useCallback(async (which: ComparisonRange) => {
        const { from, to } = RangeDates(which);
        const result = await GetTerritoryComparison(from, to);
        // Keep the last figures up when the read fails.
        setRows((current) => result ?? current ?? []);
    }, []);

    useEffect(() => {
        load(range);
        const timer = setInterval(() => load(range), DASHBOARD_POLL_MS);
        return () => clearInterval(timer);
    }, [range, load, refreshKey]);

    return { range, setRange, rows, ...ComparisonTotals(rows ?? []) };
};
