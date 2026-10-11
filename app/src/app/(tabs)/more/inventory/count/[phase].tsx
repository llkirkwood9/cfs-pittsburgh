import InventoryCountPage from "../../../../../Pages/InventoryCountPage";
import ProtectedRoute from "../../../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Checkout"]}>
            <InventoryCountPage />
        </ProtectedRoute>
    );
}
