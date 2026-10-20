import InventoryPage from "../../../../Pages/InventoryPage";
import ProtectedRoute from "../../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Checkout"]}>
            <InventoryPage />
        </ProtectedRoute>
    );
}
