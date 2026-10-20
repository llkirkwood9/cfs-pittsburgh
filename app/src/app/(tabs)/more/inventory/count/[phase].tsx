import InventoryCountPage from "../../../../../Pages/InventoryCountPage";
import ProtectedRoute from "../../../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Checkout"]} territory="count stock" inStack>
            <InventoryCountPage />
        </ProtectedRoute>
    );
}
