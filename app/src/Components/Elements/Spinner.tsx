import { ActivityIndicator } from "react-native";
import { useTheme } from "../../Hooks/UseTheme";

type Props = {
    size?: "small" | "large";
};

/**
 * Inline busy indicator - the system spinner, in the dashboard's sky blue.
 */
const Spinner = ({ size = "small" }: Props) => {
    const { isDark } = useTheme();
    return <ActivityIndicator size={size} color={isDark ? "#38bdf8" : "#0369a1"} />;
};

export default Spinner;
