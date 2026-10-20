import { router } from "expo-router";
import { View } from "react-native";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";
import Page from "../Components/Elements/Page";
import Text from "../Components/Elements/Text";

/**
 * Catch-all for an unknown screen.
 */
const NotFoundPage = () => {
    return (
        <Page scroll={false} className="items-center justify-center p-6">
            <View className="max-w-sm items-center">
                <Icon icon="fa-solid fa-compass" className="text-4xl text-zinc-400" />
                <Text className="mt-4 text-xl font-bold">Nothing here</Text>
                <Text className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
                    That screen does not exist.
                </Text>
                <Button
                    text="Back to selling"
                    icon="fa-solid fa-arrow-left"
                    onClick={() => router.replace("/")}
                    className="mt-5"
                />
            </View>
        </Page>
    );
};

export default NotFoundPage;
