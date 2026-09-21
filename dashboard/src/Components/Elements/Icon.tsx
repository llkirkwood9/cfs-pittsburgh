import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

type Props = {
    icon: any;
    className?: string;
    spin?: boolean;
};

/**
 * Local wrapper around FontAwesome. The icon prop is typed any because FontAwesome does not ship
 * first-class types for the string form; nothing else in the app imports FontAwesomeIcon directly.
 */
const Icon = ({ icon, className, spin }: Props) => {
    return <FontAwesomeIcon icon={icon} className={className} spin={spin} />;
};

export default Icon;
