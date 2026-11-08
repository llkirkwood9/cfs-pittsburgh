import SettingsPage from "../../../Pages/SettingsPage";
import ProtectedRoute from "../../../Routes/ProtectedRoute";

export default function Screen() {
    return (
        <ProtectedRoute screen="settings">
            <SettingsPage />
        </ProtectedRoute>
    );
}
