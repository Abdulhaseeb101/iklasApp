// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { SQLiteDB } from '@classes/sqlitedb';
import { CoreSiteSchema } from '@services/sites';
import { CoreUtils } from '@services/utils/utils';
import { AddonCalendar, AddonCalendarEventType } from '../calendar';

/**
 * Database variables for AddonDatabase service.
 */
export const EVENTS_TABLE = 'addon_calendar_events_3';
export const REMINDERS_TABLE = 'addon_calendar_reminders';
export const CALENDAR_SITE_SCHEMA: CoreSiteSchema = {
    name: 'AddonCalendarProvider',
    version: 4,
    canBeCleared: [EVENTS_TABLE],
    tables: [
        {
            name: EVENTS_TABLE,
            columns: [
                {
                    name: 'id',
                    type: 'INTEGER',
                    primaryKey: true,
                },
                {
                    name: 'name',
                    type: 'TEXT',
                    notNull: true,
                },
                {
                    name: 'description',
                    type: 'TEXT',
                },
                {
                    name: 'eventtype',
                    type: 'TEXT',
                },
                {
                    name: 'courseid',
                    type: 'INTEGER',
                },
                {
                    name: 'timestart',
                    type: 'INTEGER',
                },
                {
                    name: 'timeduration',
                    type: 'INTEGER',
                },
                {
                    name: 'categoryid',
                    type: 'INTEGER',
                },
                {
                    name: 'groupid',
                    type: 'INTEGER',
                },
                {
                    name: 'userid',
                    type: 'INTEGER',
                },
                {
                    name: 'instance',
                    type: 'INTEGER',
                },
                {
                    name: 'modulename',
                    type: 'TEXT',
                },
                {
                    name: 'timemodified',
                    type: 'INTEGER',
                },
                {
                    name: 'repeatid',
                    type: 'INTEGER',
                },
                {
                    name: 'visible',
                    type: 'INTEGER',
                },
                {
                    name: 'uuid',
                    type: 'TEXT',
                },
                {
                    name: 'sequence',
                    type: 'INTEGER',
                },
                {
                    name: 'subscriptionid',
                    type: 'INTEGER',
                },
                {
                    name: 'location',
                    type: 'TEXT',
                },
                {
                    name: 'eventcount',
                    type: 'INTEGER',
                },
                {
                    name: 'timesort',
                    type: 'INTEGER',
                },
                {
                    name: 'category',
                    type: 'TEXT',
                },
                {
                    name: 'course',
                    type: 'TEXT',
                },
                {
                    name: 'subscription',
                    type: 'TEXT',
                },
                {
                    name: 'canedit',
                    type: 'INTEGER',
                },
                {
                    name: 'candelete',
                    type: 'INTEGER',
                },
                {
                    name: 'deleteurl',
                    type: 'TEXT',
                },
                {
                    name: 'editurl',
                    type: 'TEXT',
                },
                {
                    name: 'viewurl',
                    type: 'TEXT',
                },
                {
                    name: 'isactionevent',
                    type: 'INTEGER',
                },
                {
                    name: 'url',
                    type: 'TEXT',
                },
                {
                    name: 'islastday',
                    type: 'INTEGER',
                },
                {
                    name: 'popupname',
                    type: 'TEXT',
                },
                {
                    name: 'mindaytimestamp',
                    type: 'INTEGER',
                },
                {
                    name: 'maxdaytimestamp',
                    type: 'INTEGER',
                },
                {
                    name: 'draggable',
                    type: 'INTEGER',
                },
            ],
        },
        {
            name: REMINDERS_TABLE,
            columns: [
                {
                    name: 'id',
                    type: 'INTEGER',
                    primaryKey: true,
                },
                {
                    name: 'eventid',
                    type: 'INTEGER',
                },
                {
                    name: 'time',
                    type: 'INTEGER',
                },
            ],
            uniqueKeys: [
                ['eventid', 'time'],
            ],
        },
    ],
    async migrate(db: SQLiteDB, oldVersion: number, siteId: string): Promise<void> {
        if (oldVersion < 3) {
            // Migrate calendar events. New format @since 3.7.
            let oldTable = 'addon_calendar_events_2';

            try {
                await db.tableExists(oldTable);
            } catch {
                // The v2 table doesn't exist, try with v1.
                oldTable = 'addon_calendar_events';
            }

            await db.migrateTable(oldTable, EVENTS_TABLE);
        }

        if (oldVersion < 4) {
            // Migrate reminders. New format @since 4.0.
            const defaultTime = await CoreUtils.ignoreErrors(AddonCalendar.getDefaultNotificationTime(siteId));
            if (defaultTime) {
                // Convert from minutes to seconds.
                AddonCalendar.setDefaultNotificationTime(defaultTime * 60, siteId);
            }

            const records = await db.getAllRecords<AddonCalendarReminderDBRecord>(REMINDERS_TABLE);
            const events: Record<number, AddonCalendarEventDBRecord> = {};

            await Promise.all(records.map(async (record) => {
                // Get the event to compare the reminder time with the event time.
                if (!events[record.eventid]) {
                    try {
                        events[record.eventid] = await db.getRecord(EVENTS_TABLE, { id: record.eventid });
                    } catch {
                        // Event not found in local DB, shouldn't happen. Delete the reminder.
                        await db.deleteRecords(REMINDERS_TABLE, { id: record.id });

                        return;
                    }
                }

                if (!record.time || record.time === -1) {
                    // Default reminder. Use null now.
                    record.time = null;
                } else if (record.time > events[record.eventid].timestart) {
                    // Reminder is after the event, delete it.
                    await db.deleteRecords(REMINDERS_TABLE, { id: record.id });

                    return;
                } else {
                    record.time = events[record.eventid].timestart - record.time;
                }

                return db.insertRecord(REMINDERS_TABLE, record);
            }));
        }
    },
};

export type AddonCalendarEventDBRecord = {
    id: number;
    name: string;
    description: string;
    eventtype: AddonCalendarEventType;
    timestart: number;
    timeduration: number;
    categoryid?: number;
    groupid?: number;
    userid?: number;
    instance?: number;
    modulename?: string;
    timemodified: number;
    repeatid?: number;
    visible: number;
    // Following properties are only available on AddonCalendarGetEventsEvent
    courseid?: number;
    uuid?: string;
    sequence?: number;
    subscriptionid?: number;
    // Following properties are only available on AddonCalendarCalendarEvent
    location?: string;
    eventcount?: number;
    timesort?: number;
    category?: string;
    course?: string;
    subscription?: string;
    canedit?: number;
    candelete?: number;
    deleteurl?: string;
    editurl?: string;
    viewurl?: string;
    isactionevent?: number;
    url?: string;
    islastday?: number;
    popupname?: string;
    mindaytimestamp?: number;
    maxdaytimestamp?: number;
    draggable?: number;
};

export type AddonCalendarReminderDBRecord = {
    id: number;
    eventid: number;
    time: number | null; // Number of seconds before the event, null for default time.
};
