import { useCallback, useEffect, useState } from "react";
import { Toast } from "@host";
import { useAuth } from "../Context/AuthContext";
import { BuildEvent, EventToForm, NewEventDefaults } from "../Lib/Events";
import type { EventForm } from "../Lib/Events";
import { RateAsPercent } from "../Lib/Format";
import type { Event } from "../Models/Event";
import { DefaultGeneralSettings } from "../Models/GeneralSettings";
import type { GeneralSettings } from "../Models/GeneralSettings";
import { HasRole } from "../Models/User";
import { AddEvent, DeleteEvent, GetEvents, UpdateEvent } from "../Services/EventServices";

const emptyForm: EventForm = EventToForm({}, null, DefaultGeneralSettings);

/**
 * The Events screen: the events, the add/edit form and deleting one.
 * @param settingsFor Reads a territory's settings, for a new event's rates.
 * @param territoryInView The territory picked in the menu bar, or null for all of them.
 * @param picksTerritory Whether the user picks which territory an event is in - anyone with more
 *     than one.
 * @returns The screen's state and handlers.
 */
export const useEvents = (
    settingsFor: (territoryId: number | null | undefined) => Promise<GeneralSettings>,
    territoryInView: number | null,
    picksTerritory: boolean
) => {
    const { user } = useAuth();
    // A system admin deletes an event for good, orders and all.
    const deletesForGood = HasRole(user?.role, "SystemAdmin");

    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [editing, setEditing] = useState<Event | null>(null);
    const [deleting, setDeleting] = useState<Event | null>(null);
    const [saving, setSaving] = useState<boolean>(false);
    const [form, setForm] = useState<EventForm>(emptyForm);

    const load = useCallback(async () => {
        setEvents(await GetEvents());
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // The territory a new event goes in when none is picked.
    const homeTerritory = territoryInView ?? user?.territoryIds?.[0] ?? null;

    /**
     * Changes one field of the open form.
     * @param key The field.
     * @param value Its new value.
     */
    const setField = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
        setForm((f) => ({ ...f, [key]: value }));

    /**
     * Opens the form for an event.
     * @param event The event, or a new one's starting values.
     */
    const open = (event: Event) => {
        setEditing(event);
        setForm(EventToForm(event, homeTerritory, DefaultGeneralSettings));
    };

    /** Opens the form for a new event. */
    const openNew = async () =>
        open(NewEventDefaults(events, homeTerritory, await settingsFor(homeTerritory)));

    /**
     * Picks the territory on the open form. A new event's rates come from its territory's
     * settings.
     * @param id The territory.
     */
    const pickTerritory = async (id: number | null) => {
        setField("territoryId", id);
        if (editing?.id || id == null) return;
        const defaults = await settingsFor(id);
        setForm((f) => ({
            ...f,
            taxPercent: RateAsPercent(defaults.defaultSalesTaxRate),
            feePercent: RateAsPercent(defaults.defaultCcProcessingFeeRate),
        }));
    };

    const handleSave = async () => {
        const built = BuildEvent(form, editing?.id, picksTerritory);
        if ("problem" in built) return Toast.Warning(built.problem);

        setSaving(true);
        const saved = editing?.id ? await UpdateEvent(built.event) : await AddEvent(built.event);
        setSaving(false);

        if (!saved) return;

        Toast.Success(`${saved.organization} saved.`);
        setEditing(null);
        await load();
    };

    const handleDelete = async () => {
        if (!deleting?.id) return;

        const success = await DeleteEvent(deleting.id, deletesForGood);
        setDeleting(null);

        if (success) {
            Toast.Success("Event deleted.");
            await load();
        }
    };

    return {
        events,
        loading,
        load,
        deletesForGood,
        editing,
        close: () => setEditing(null),
        form,
        setField,
        open,
        openNew,
        pickTerritory,
        saving,
        handleSave,
        deleting,
        setDeleting,
        handleDelete,
    };
};
