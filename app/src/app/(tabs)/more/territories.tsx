import TerritoriesPage from "../../../Pages/TerritoriesPage";
import ProtectedRoute from "../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute screen="territories">
            <TerritoriesPage />
        </ProtectedRoute>
    );
}
