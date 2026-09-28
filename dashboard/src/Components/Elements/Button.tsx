import Icon from "./Icon";

type Props = {
    id?: string;
    text?: string;
    icon?: any;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
    loading?: boolean;
    type?: "button" | "submit";
    title?: string;
};

/**
 * The single button primitive. Minimum height is 48px because every control in this app has to
 * be hittable with a thumb on a tablet held in one hand.
 */
const Button = ({
    id,
    text,
    icon,
    onClick,
    className = "",
    disabled = false,
    loading = false,
    type = "button",
    title,
}: Props) => {
    return (
        <button
            id={id}
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            title={title}
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-base
                font-semibold text-white transition-colors select-none
                active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                    // Tailwind orders colours by palette, not by class order, so a caller's red or
                    // green would lose to the default blue. Only use the default when none is given.
                    /(^|\s)bg-/.test(className)
                        ? ""
                        : "bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-700"
                } ${className}`}
        >
            {loading ? <Icon icon="fa-solid fa-circle-notch" spin /> : icon && <Icon icon={icon} />}
            {text && <span>{text}</span>}
        </button>
    );
};

export default Button;
