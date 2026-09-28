type Props = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    maxLength?: number;
    rows?: number;
};

/**
 * Labelled multi-line text box, styled to match TextField. Also 16px, so iPad Safari does not
 * zoom the page when it is focused.
 */
const TextArea = ({
    label,
    value,
    onChange,
    onBlur,
    placeholder,
    className = "",
    disabled = false,
    maxLength,
    rows = 2,
}: Props) => {
    return (
        <label className={`flex flex-col gap-1 ${className}`}>
            <span className="flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
                {maxLength && value.length > maxLength * 0.8 && (
                    <span className="font-normal normal-case tabular-nums">
                        {value.length}/{maxLength}
                    </span>
                )}
            </span>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                disabled={disabled}
                maxLength={maxLength}
                rows={rows}
                className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base
                    text-zinc-900 outline-none transition-colors
                    focus:border-sky-600 focus:ring-2 focus:ring-sky-600/30
                    disabled:opacity-60
                    dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-sky-500"
            />
        </label>
    );
};

export default TextArea;
