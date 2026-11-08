import { createBrowserRouter } from "react-router-dom";
import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import App from "../App";
import HomeRedirect from "./HomeRedirect";
import ProtectedRoute from "./ProtectedRoute";
import CatalogPage from "../Pages/CatalogPage";
import CheckoutPage from "../Pages/CheckoutPage";
import CrewPage from "../Pages/CrewPage";
import DashboardPage from "../Pages/DashboardPage";
import ErrorPage from "../Pages/ErrorPage";
import EventCloseOutPage from "../Pages/EventCloseOutPage";
import EventSheetsPage from "../Pages/EventSheetsPage";
import EventsPage from "../Pages/EventsPage";
import InventoryPage from "../Pages/InventoryPage";
import InventoryCountPage from "../Pages/InventoryCountPage";
import LoginPage from "../Pages/LoginPage";
import NotFoundPage from "../Pages/NotFoundPage";
import OrdersPage from "../Pages/OrdersPage";
import ReceiptPage from "../Pages/ReceiptPage";
import SalesPage from "../Pages/SalesPage";
import SettingsPage from "../Pages/SettingsPage";
import TerritoriesPage from "../Pages/TerritoriesPage";
import UnauthorizedPage from "../Pages/UnauthorizedPage";
import type { ScreenKey } from "@shared/Lib/Screens";

/** What App reads from the matched route: its screen, or its own title, and whether to print it bare. */
export type RouteHandle = {
    screen?: ScreenKey;
    title?: string;
    /** Printable pages drop the app chrome so the paper copy is just the sheets. */
    chromeless?: boolean;
};

/** A screen behind sign-in, guarded as the screen table says. */
const screen = (
    path: string,
    key: ScreenKey,
    page: ReactNode,
    chromeless = false
): RouteObject => ({
    path,
    handle: { screen: key, chromeless } satisfies RouteHandle,
    element: <ProtectedRoute screen={key}>{page}</ProtectedRoute>,
});

export const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: [
            { index: true, element: <HomeRedirect /> },
            {
                path: "login",
                handle: { title: "Sign in", chromeless: true } satisfies RouteHandle,
                element: <LoginPage />,
            },
            screen("sales", "sales", <SalesPage />),
            screen("checkout", "checkout", <CheckoutPage />),
            screen("checkout/:orderId", "checkout", <CheckoutPage />),
            screen("receipt/:orderId", "receipt", <ReceiptPage />, true),
            screen("orders", "orders", <OrdersPage />),
            screen("dashboard", "dashboard", <DashboardPage />),
            screen("inventory", "inventory", <InventoryPage />),
            screen("inventory/count/:phase", "inventoryCount", <InventoryCountPage />),
            screen("catalog", "catalog", <CatalogPage />),
            screen("events", "events", <EventsPage />),
            screen("events/:eventId/close", "closeOut", <EventCloseOutPage />),
            screen("events/:eventId/sheets", "eventSheets", <EventSheetsPage />, true),
            screen("crew", "crew", <CrewPage />),
            screen("settings", "settings", <SettingsPage />),
            screen("territories", "territories", <TerritoriesPage />),
            { path: "error", element: <ErrorPage /> },
            { path: "unauthorized", element: <UnauthorizedPage /> },
            { path: "*", element: <NotFoundPage /> },
        ],
    },
]);
