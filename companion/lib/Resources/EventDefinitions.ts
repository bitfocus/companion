import dayjs from 'dayjs'
import os from 'os'
import type { EventDefinition } from '@companion-app/shared/Model/Common.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { InternalVisitor } from '../Internal/Types.js'

/**
 * Definitions for the trigger event types
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */

export const EventDefinitions: Record<string, EventDefinition> = {
	interval: {
		name: 'Time Interval',
		options: [
			{
				id: 'seconds',
				type: 'number',
				label: 'Interval (seconds)',
				min: 1,
				max: Number.MAX_SAFE_INTEGER,
				default: 10,
			},
		],
	},
	timeofday: {
		name: 'Time of Day',
		options: [
			{
				id: 'time',
				label: 'Time',
				type: 'internal:time',
			},
			{
				id: 'days',
				label: 'Days',
				type: 'multidropdown',
				minChoicesForSearch: 10,
				minSelection: 1,
				choices: Array(7)
					.keys()
					.toArray()
					.map((i) => {
						return {
							id: i,
							label: dayjs().day(i).format('ddd'),
						}
					}),
				default: Array(7).keys().toArray(),
			},
		],
	},
	specificDate: {
		name: 'Once on Specific Date & Time',
		options: [
			{
				id: 'date',
				label: 'Date',
				type: 'internal:date',
			},
			{
				id: 'time',
				label: 'Time',
				type: 'internal:time',
			},
		],
	},
	sun_event: {
		name: 'On Sunrise/Sunset',
		options: [
			{
				id: 'type',
				label: 'Sunrise / Sunset',
				type: 'dropdown',
				default: 'sunrise',
				choices: [
					{ id: 'sunrise', label: 'Sunrise' },
					{ id: 'sunset', label: 'Sunset' },
				],
			},
			{
				id: 'latitude',
				label: 'Latitude',
				type: 'number',
				default: 0,
				min: -90,
				max: 90,
			},
			{
				id: 'longitude',
				label: 'Longitude',
				type: 'number',
				default: 0,
				min: -180,
				max: 180,
			},
			{
				id: 'offset',
				label: 'Offset (in min)',
				type: 'number',
				default: 0,
				min: -720,
				max: 720,
			},
		],
	},
	startup: {
		name: 'Startup',
		options: [
			{
				id: 'delay',
				type: 'number',
				label: 'Delay (milliseconds)',
				min: 0,
				max: Number.MAX_SAFE_INTEGER,
				default: 10000,
			},
		],
	},
	client_connect: {
		name: 'Web client connect',
		options: [
			{
				id: 'delay',
				type: 'number',
				label: 'Delay (milliseconds)',
				min: 0,
				max: Number.MAX_SAFE_INTEGER,
				default: 0,
			},
		],
	},
	button_press: {
		name: 'On any button press',
		options: [],
	},
	button_depress: {
		name: 'On any button depress',
		options: [],
	},
	condition_true: {
		name: 'On condition becoming true',
		options: [],
	},
	condition_false: {
		name: 'On condition becoming false',
		options: [],
	},
	variable_changed: {
		name: 'On variable change',
		options: [
			{
				type: 'internal:variable',
				id: 'variableId',
				label: 'Variable to watch',
				supportsLocal: true,
			},
		],
	},
}

// Some behaviours are only possible on some platforms
switch (os.platform()) {
	case 'darwin':
	case 'win32':
		Object.assign(EventDefinitions, {
			computer_locked: {
				name: 'On computer becoming locked',
				options: [],
			},
			computer_unlocked: {
				name: 'On computer becoming unlocked',
				options: [],
			},
		})
		break
}

/**
 * Visit any references within an event
 * @param visitor Visitor to be used
 * @param event Events to fixup
 */
export function visitEventOptions(visitor: InternalVisitor, event: EventInstance): void {
	// Handle special cases
	if (event.type === 'variable_changed') {
		visitor.visitVariableName(event.options, 'variableId')
	}

	for (const key of Object.keys(event.options || {})) {
		visitor.visitString(event.options, key)
	}
}
