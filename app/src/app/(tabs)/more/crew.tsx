import CrewPage from "../../../Pages/CrewPage";
import ProtectedRoute from "../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Manager"]}>
            <CrewPage />
        </ProtectedRoute>
    );
}
