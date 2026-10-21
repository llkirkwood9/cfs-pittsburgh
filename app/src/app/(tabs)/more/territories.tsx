import TerritoriesPage from "../../../Pages/TerritoriesPage";
import ProtectedRoute from "../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Admin"]}>
            <TerritoriesPage />
        </ProtectedRoute>
    );
}
