import { View } from "react-native";
import Spinner from "./Spinner";
import Text from "./Text";

/**
 * Full-screen loading state, shown while the session is being restored on app start.
 */
const LoadingPage = () => {
    return (
        <View className="flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900">
            <View className="items-center gap-3">
                <Spinner size="large" />
                <Text className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</Text>
            </View>
        </View>
    );
};

export default LoadingPage;
