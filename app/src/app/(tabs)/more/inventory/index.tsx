import InventoryPage from "../../../../Pages/InventoryPage";
import ProtectedRoute from "../../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Checkout"]} territory="see and count stock" inStack>
            <InventoryPage />
        </ProtectedRoute>
    );
}
