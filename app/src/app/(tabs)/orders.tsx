import OrdersPage from "../../Pages/OrdersPage";
import ProtectedRoute from "../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute>
            <OrdersPage />
        </ProtectedRoute>
    );
}
