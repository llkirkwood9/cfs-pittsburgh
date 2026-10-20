import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";
import Page from "../Components/Elements/Page";
import Text from "../Components/Elements/Text";

type ErrorParams = {
    code?: string;
    errorMessage?: string;
    exception?: string;
};

/**
 * Where a 500 lands. The detail is kept on screen rather than in a toast so the crew has
 * something they can read out when they call it in.
 */
const ErrorPage = () => {
    const state = useLocalSearchParams<ErrorParams>();

    return (
        <Page edges={["left", "right", "bottom"]} className="items-center justify-center p-6">
            <View className="w-full max-w-lg items-center rounded-xl bg-white p-6 raised dark:bg-zinc-800">
                <Icon
                    icon="fa-solid fa-triangle-exclamation"
                    className="text-4xl text-red-600 dark:text-red-400"
                />
                <Text className="mt-4 text-center text-xl font-bold">
                    Something broke on the server
                </Text>
                <Text className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
                    {state.errorMessage || "An internal error occurred."}
                </Text>

                {state.exception ? (
                    <ScrollView className="mt-4 max-h-40 w-full rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
                        <Text className="font-mono text-xs text-zinc-700 dark:text-zinc-300" selectable>
                            {state.exception}
                        </Text>
                    </ScrollView>
                ) : null}

                <View className="mt-5 flex-row justify-center gap-2">
                    <Button
                        text="Back to selling"
                        icon="fa-solid fa-arrow-left"
                        onClick={() => router.replace("/")}
                        className="bg-zinc-500 dark:bg-zinc-600"
                    />
                    <Button
                        text="Try again"
                        icon="fa-solid fa-rotate"
                        onClick={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                    />
                </View>
            </View>
        </Page>
    );
};

export default ErrorPage;
