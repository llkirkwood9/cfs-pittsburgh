import TabButton from "../Elements/TabButton";
import { IsPastEvent } from "@shared/Lib/Events";
import type { Event } from "@shared/Models/Event";

type Props = {
    /** The events to offer, from useEventFilter. */
    events: Event[];
    /** Whether every event is picked. */
    allPicked: boolean;
    /** The event picked, when one is. */
    pickedEventId: number | null | undefined;
    /** Whether each event says which territory it's in - when viewing every territory. */
    showTerritory: boolean;
    onPickAll: () => void;
    onPickEvent: (eventId: number) => void;
    className?: string;
};

/** The strip of event tabs on the Dashboard and Orders screens: All events, then each event. */
const EventFilter = ({
    events,
    allPicked,
    pickedEventId,
    showTerritory,
    onPickAll,
    onPickEvent,
    className = "",
}: Props) => (
    <div className={`-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 ${className}`}>
        <TabButton text="All events" active={allPicked} onClick={onPickAll} />
        {events.map((event) => (
            <TabButton
                key={event.id}
                text={event.organization ?? ""}
                subtext={showTerritory ? (event.territoryName ?? undefined) : undefined}
                tag={IsPastEvent(event) ? "Past" : undefined}
                active={!allPicked && event.id === pickedEventId}
                onClick={() => event.id && onPickEvent(event.id)}
            />
        ))}
    </div>
);

export default EventFilter;
