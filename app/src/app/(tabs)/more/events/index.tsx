import EventsPage from "../../../../Pages/EventsPage";
import ProtectedRoute from "../../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Admin"]}>
            <EventsPage />
        </ProtectedRoute>
    );
}
