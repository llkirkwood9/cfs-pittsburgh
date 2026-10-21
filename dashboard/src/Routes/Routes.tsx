import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import HomeRedirect from "./HomeRedirect";
import ProtectedRoute from "./ProtectedRoute";
import RequireTerritory from "./RequireTerritory";
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

export const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: [
            { index: true, element: <HomeRedirect /> },
            { path: "login", element: <LoginPage /> },
            {
                path: "sales",
                element: (
                    <ProtectedRoute roles={["Sales"]}>
                        <RequireTerritory purpose="take orders">
                            <SalesPage />
                        </RequireTerritory>
                    </ProtectedRoute>
                ),
            },
            {
                path: "checkout",
                element: (
                    <ProtectedRoute roles={["Checkout"]}>
                        <RequireTerritory purpose="work the checkout table">
                            <CheckoutPage />
                        </RequireTerritory>
                    </ProtectedRoute>
                ),
            },
            {
                path: "checkout/:orderId",
                element: (
                    <ProtectedRoute roles={["Checkout"]}>
                        <RequireTerritory purpose="work the checkout table">
                            <CheckoutPage />
                        </RequireTerritory>
                    </ProtectedRoute>
                ),
            },
            {
                path: "receipt/:orderId",
                element: (
                    <ProtectedRoute>
                        <ReceiptPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: "orders",
                element: (
                    <ProtectedRoute>
                        <OrdersPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: "dashboard",
                element: (
                    <ProtectedRoute>
                        <DashboardPage />
                    </ProtectedRoute>
                ),
            },
            {
                // Checkout, Sales & Checkout and managers up keep the counts; floor-only reps do not.
                path: "inventory",
                element: (
                    <ProtectedRoute roles={["Checkout"]}>
                        <RequireTerritory purpose="see and count stock">
                            <InventoryPage />
                        </RequireTerritory>
                    </ProtectedRoute>
                ),
            },
            {
                path: "inventory/count/:phase",
                element: (
                    <ProtectedRoute roles={["Checkout"]}>
                        <RequireTerritory purpose="count stock">
                            <InventoryCountPage />
                        </RequireTerritory>
                    </ProtectedRoute>
                ),
            },
            {
                path: "catalog",
                element: (
                    <ProtectedRoute roles={["Manager"]}>
                        <RequireTerritory purpose="look after the catalog">
                            <CatalogPage />
                        </RequireTerritory>
                    </ProtectedRoute>
                ),
            },
            {
                path: "events",
                element: (
                    <ProtectedRoute roles={["Manager"]}>
                        <EventsPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: "events/:eventId/close",
                element: (
                    <ProtectedRoute roles={["Manager"]}>
                        <EventCloseOutPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: "events/:eventId/sheets",
                element: (
                    <ProtectedRoute roles={["Manager"]}>
                        <EventSheetsPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: "crew",
                element: (
                    <ProtectedRoute roles={["Manager"]}>
                        <CrewPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: "settings",
                element: (
                    <ProtectedRoute roles={["Manager"]}>
                        <SettingsPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: "territories",
                element: (
                    <ProtectedRoute roles={["Admin"]}>
                        <TerritoriesPage />
                    </ProtectedRoute>
                ),
            },
            { path: "error", element: <ErrorPage /> },
            { path: "unauthorized", element: <UnauthorizedPage /> },
            { path: "*", element: <NotFoundPage /> },
        ],
    },
]);
