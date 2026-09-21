import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import HomeRedirect from "./HomeRedirect";
import ProtectedRoute from "./ProtectedRoute";
import CatalogPage from "../Pages/CatalogPage";
import CheckoutPage from "../Pages/CheckoutPage";
import CrewPage from "../Pages/CrewPage";
import DashboardPage from "../Pages/DashboardPage";
import ErrorPage from "../Pages/ErrorPage";
import EventsPage from "../Pages/EventsPage";
import LoginPage from "../Pages/LoginPage";
import NotFoundPage from "../Pages/NotFoundPage";
import OrdersPage from "../Pages/OrdersPage";
import ReceiptPage from "../Pages/ReceiptPage";
import SalesPage from "../Pages/SalesPage";
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
                        <SalesPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: "checkout",
                element: (
                    <ProtectedRoute roles={["Checkout"]}>
                        <CheckoutPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: "checkout/:orderId",
                element: (
                    <ProtectedRoute roles={["Checkout"]}>
                        <CheckoutPage />
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
                path: "catalog",
                element: (
                    <ProtectedRoute roles={["Admin"]}>
                        <CatalogPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: "events",
                element: (
                    <ProtectedRoute roles={["Admin"]}>
                        <EventsPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: "crew",
                element: (
                    <ProtectedRoute roles={["Admin"]}>
                        <CrewPage />
                    </ProtectedRoute>
                ),
            },
            { path: "error", element: <ErrorPage /> },
            { path: "unauthorized", element: <UnauthorizedPage /> },
            { path: "*", element: <NotFoundPage /> },
        ],
    },
]);
