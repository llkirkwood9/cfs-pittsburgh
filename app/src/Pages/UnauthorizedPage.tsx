import { router } from "expo-router";
import { View } from "react-native";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";
import Page from "../Components/Elements/Page";
import Text from "../Components/Elements/Text";
import { useAuth } from "../Context/AuthContext";
import { HomePathForRole } from "../Lib/RoleRoutes";

/**
 * Shown when a signed-in crew member reaches a screen their role does not cover.
 */
const UnauthorizedPage = () => {
    const { user } = useAuth();

    return (
        <Page scroll={false} className="items-center justify-center p-6">
            <View className="max-w-sm items-center">
                <Icon icon="fa-solid fa-lock" className="text-4xl text-amber-600 dark:text-amber-400" />
                <Text className="mt-4 text-xl font-bold">Not your table</Text>
                <Text className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
                    Your account does not cover this screen. Ask an administrator if you need
                    access.
                </Text>
                <Button
                    text="Back to your screen"
                    icon="fa-solid fa-arrow-left"
                    onClick={() => router.replace(HomePathForRole(user?.role))}
                    className="mt-5"
                />
            </View>
        </Page>
    );
};

export default UnauthorizedPage;
