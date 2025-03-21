/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import type {
	ActionForVisitor,
	FeedbackForVisitor,
	InternalModuleFragment,
	InternalModuleFragmentEvents,
	InternalVisitor,
} from './Types.js'
import type { VariableDefinitionTmp } from '../Instance/Wrapper.js'
import { EventEmitter } from 'events'
import type { InternalModuleUtils } from './Util.js'

export class InternalTime extends EventEmitter<InternalModuleFragmentEvents> implements InternalModuleFragment {
	readonly #startTime = Math.floor(Date.now() / 1000)

	constructor(_internalUtils: InternalModuleUtils) {
		super()

		setInterval(() => {
			this.updateVariables()
		}, 500) // Do it at 2hz to make sure we dont skip one
	}

	getVariableDefinitions(): VariableDefinitionTmp[] {
		return [
			{
				label: 'Date ISO (YYYY-MM-DD)',
				name: 'date_iso',
			},
			{
				label: 'Date (Year)',
				name: 'date_y',
			},
			{
				label: 'Date (Month)',
				name: 'date_m',
			},
			{
				label: 'Date (Day)',
				name: 'date_d',
			},
			{
				label: 'Day of week (number)',
				name: 'date_dow',
			},
			{
				label: 'Day of week (name)',
				name: 'date_weekday',
			},
			{
				label: 'Time of day (HH:MM:SS)',
				name: 'time_hms',
			},
			{
				label: 'Time of day (HH:MM)',
				name: 'time_hm',
			},
			{
				label: 'Time of day (HH)',
				name: 'time_h',
			},
			{
				label: 'Time of day (MM)',
				name: 'time_m',
			},
			{
				label: 'Time of day (SS)',
				name: 'time_s',
			},
			{
				label: 'Time of day (HH:MM:SS) (12 hour)',
				name: 'time_hms_12',
			},
			{
				label: 'Time of day (HH:MM) (12 hour)',
				name: 'time_hm_12',
			},
			{
				label: 'Time of day (HH) (12 hour)',
				name: 'time_h_12',
			},
			{
				label: 'UNIX timestamp (S)',
				name: 'time_unix',
			},
			{
				label: 'Uptime (seconds)',
				name: 'uptime',
			},
		]
	}

	updateVariables(): void {
		const now = new Date()
		const hours = now.getHours()
		const hours12 = hours % 12
		const hh = `0${hours}`.slice(-2)
		const hh12 = `0${hours12 === 0 ? 12 : hours12}`.slice(-2)
		const mm = `0${now.getMinutes()}`.slice(-2)
		const ss = `0${now.getSeconds()}`.slice(-2)
		const year = now.getFullYear()
		const month = `0${now.getMonth() + 1}`.slice(-2)
		const day = `0${now.getDate()}`.slice(-2)
		const hhmm = `${hh}:${mm}`
		const hhmmss = `${hhmm}:${ss}`
		const hhmm12 = `${hh12}:${mm}`
		const hhmmss12 = `${hhmm12}:${ss}`
		const ts = Math.floor(now.getTime() / 1000)

		const uptime = ts - this.#startTime

		this.emit('setVariables', {
			date_iso: `${year}-${month}-${day}`,
			date_y: year,
			date_m: month,
			date_d: day,
			date_dow: now.getDay(),
			date_weekday: now.toLocaleString(undefined, { weekday: 'long' }),

			time_hms: hhmmss,
			time_hm: hhmm,

			time_h: hh,
			time_m: mm,
			time_s: ss,
			time_unix: ts,

			time_hms_12: hhmmss12,
			time_hm_12: hhmm12,
			time_h_12: hh12,

			uptime,
		})
	}

	visitReferences(_visitor: InternalVisitor, _actions: ActionForVisitor[], _feedbacks: FeedbackForVisitor[]): void {
		// Nothing to do
	}
}
