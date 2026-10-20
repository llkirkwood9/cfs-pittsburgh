import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SizeGuideButton from "./SizeGuideButton";
import ThemeToggle from "./ThemeToggle";
import UserProfileDropdown from "./UserProfileDropdown";
import Icon from "../Elements/Icon";
import LightStatusBar from "../Elements/LightStatusBar";
import Text from "../Elements/Text";
import { useSettings } from "../../Context/SettingsContext";

/**
 * The dashboard's menu bar, minus its tabs - the native tab bar has those. It keeps the app name
 * and the things every screen needs within a thumb's reach: the size chart, the theme and who is
 * signed in. Each tab's screen draws it across its top.
 */
const Navbar = () => {
    const { settings } = useSettings();
    const insets = useSafeAreaInsets();

    return (
        <View className="bg-zinc-900 raised-lg dark:bg-black" style={{ paddingTop: insets.top }}>
            {/* The bar is dark in both themes, so the status bar over it is always white. */}
            <LightStatusBar />
            <View className="mx-auto h-14 w-full max-w-screen-2xl flex-row items-center gap-2 px-3">
                <Icon icon="fa-solid fa-bed" className="text-xl text-sky-400" />
                <Text className="flex-1 text-base font-bold tracking-tight text-white" numberOfLines={1}>
                    {settings.appName}
                </Text>
                <SizeGuideButton />
                <ThemeToggle />
                <UserProfileDropdown />
            </View>
        </View>
    );
};

export default Navbar;
