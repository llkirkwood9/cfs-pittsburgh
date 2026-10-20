import CatalogPage from "../../../Pages/CatalogPage";
import ProtectedRoute from "../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Admin"]}>
            <CatalogPage />
        </ProtectedRoute>
    );
}
