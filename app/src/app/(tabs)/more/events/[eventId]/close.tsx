import EventCloseOutPage from "../../../../../Pages/EventCloseOutPage";
import ProtectedRoute from "../../../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute roles={["Manager"]}>
            <EventCloseOutPage />
        </ProtectedRoute>
    );
}
