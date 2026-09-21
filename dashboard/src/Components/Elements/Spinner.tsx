import Icon from "./Icon";

type Props = {
    className?: string;
};

/**
 * Inline busy indicator.
 */
const Spinner = ({ className = "" }: Props) => {
    return (
        <Icon
            icon="fa-solid fa-circle-notch"
            spin
            className={`text-sky-700 dark:text-sky-400 ${className}`}
        />
    );
};

export default Spinner;
