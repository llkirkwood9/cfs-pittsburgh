import type { ReactNode } from "react";
import { View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Text from "../Elements/Text";

type Props = {
    id: string;
    title: string;
    icon: string;
    description: ReactNode;
    /** A short tag beside the title, such as "Default wording". */
    badge?: ReactNode;
    children: ReactNode;
    /** What the footer says when nothing is waiting to be saved. */
    status: string;
    dirty: boolean;
    saving: boolean;
    onSave: () => void;
    onDiscard: () => void;
    /** Shown only when there is something other than the defaults to go back from. */
    onReset?: () => void;
    /** Where the card sits on the page, so the section buttons can scroll to it. */
    onLayout?: (id: string, y: number) => void;
};

/**
 * One group of settings with its own Save, so changing the phone number never saves a half-
 * written email. Discard puts the saved values back; Reset to default asks the card to start over
 * from the app's own values.
 */
const SettingsCard = ({
    id,
    title,
    icon,
    description,
    badge,
    children,
    status,
    dirty,
    saving,
    onSave,
    onDiscard,
    onReset,
    onLayout,
}: Props) => {
    return (
        <View
            onLayout={(e: LayoutChangeEvent) => onLayout?.(id, e.nativeEvent.layout.y)}
            className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800"
        >
            <View className="mb-3 flex-row flex-wrap items-start justify-between gap-2">
                <View className="min-w-0 flex-1">
                    <View className="flex-row items-center gap-2" accessibilityRole="header">
                        <Icon icon={icon} className="text-base text-zinc-500 dark:text-zinc-400" />
                        <Text className="text-lg font-semibold">{title}</Text>
                    </View>
                    {typeof description === "string" ? (
                        <Text className="text-sm text-zinc-600 dark:text-zinc-400">{description}</Text>
                    ) : (
                        description
                    )}
                </View>
                {badge}
            </View>

            {children}

            <View className="mt-4 flex-row flex-wrap items-center gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <Text className="mr-auto min-w-[140px] flex-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {dirty ? "You have unsaved changes." : status}
                </Text>
                {onReset && (
                    <Button
                        text="Reset to default"
                        icon="fa-solid fa-rotate-left"
                        onClick={onReset}
                        disabled={saving}
                        className="bg-zinc-500 dark:bg-zinc-600"
                    />
                )}
                {dirty && (
                    <Button
                        text="Discard changes"
                        icon="fa-solid fa-xmark"
                        onClick={onDiscard}
                        disabled={saving}
                        className="bg-zinc-500 dark:bg-zinc-600"
                    />
                )}
                <Button
                    text={saving ? "Saving..." : "Save"}
                    icon="fa-solid fa-floppy-disk"
                    onClick={onSave}
                    loading={saving}
                    disabled={!dirty}
                    className="bg-green-700 dark:bg-green-600"
                />
            </View>
        </View>
    );
};

export default SettingsCard;
