import type { ReactNode } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";

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
}: Props) => {
    return (
        <section
            id={id}
            aria-labelledby={`${id}-title`}
            className="scroll-mt-20 rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800"
        >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h2
                        id={`${id}-title`}
                        className="flex items-center gap-2 text-lg font-semibold"
                    >
                        <Icon icon={icon} className="text-base text-zinc-500 dark:text-zinc-400" />
                        {title}
                    </h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
                </div>
                {badge}
            </div>

            {children}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <p className="mr-auto text-xs text-zinc-500 dark:text-zinc-400">
                    {dirty ? "You have unsaved changes." : status}
                </p>
                {onReset && (
                    <Button
                        text="Reset to default"
                        icon="fa-solid fa-rotate-left"
                        onClick={onReset}
                        disabled={saving}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                )}
                {dirty && (
                    <Button
                        text="Discard changes"
                        icon="fa-solid fa-xmark"
                        onClick={onDiscard}
                        disabled={saving}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                )}
                <Button
                    text={saving ? "Saving..." : "Save"}
                    icon="fa-solid fa-floppy-disk"
                    onClick={onSave}
                    loading={saving}
                    disabled={!dirty}
                    className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                />
            </div>
        </section>
    );
};

export default SettingsCard;
