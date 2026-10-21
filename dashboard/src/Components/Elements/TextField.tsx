type Props = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    type?: "text" | "email" | "tel" | "date" | "password";
    inputMode?: "text" | "decimal" | "numeric" | "tel" | "email";
    className?: string;
    disabled?: boolean;
    maxLength?: number;
    autoFocus?: boolean;
    /** Lets password managers recognise the field, e.g. "username" or "current-password". */
    autoComplete?: string;
};

/**
 * Labelled text input. The 16px font size is deliberate: anything smaller makes iPad Safari zoom
 * the page when the field is focused, which throws the rep off mid-order.
 */
const TextField = ({
    label,
    value,
    onChange,
    onBlur,
    placeholder,
    type = "text",
    inputMode,
    className = "",
    disabled = false,
    maxLength,
    autoFocus = false,
    autoComplete,
}: Props) => {
    return (
        <label className={`flex flex-col gap-1 ${className}`}>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
            </span>
            <input
                type={type}
                inputMode={inputMode}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                disabled={disabled}
                maxLength={maxLength}
                autoFocus={autoFocus}
                autoComplete={autoComplete}
                className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-base
                    text-zinc-900 outline-hidden transition-colors
                    focus:border-sky-600 focus:ring-2 focus:ring-sky-600/30
                    disabled:opacity-60
                    dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-sky-500 dark:scheme-dark"
            />
        </label>
    );
};

export default TextField;
