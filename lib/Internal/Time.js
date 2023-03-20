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

import CoreBase from '../Core/Base.js'

export default class Time extends CoreBase {
	constructor(registry, internalModule) {
		super(registry, 'internal', 'Internal/Time')

		// this.internalModule = internalModule

		this.time_interval = setInterval(() => {
			this.updateVariables()
		}, 500) // Do it at 2hz to make sure we dont skip one
	}

	getVariableDefinitions() {
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
				label: 'UNIX timestamp (S)',
				name: 'time_unix',
			},
		]
	}

	updateVariables() {
		const now = new Date()
		const hh = `0${now.getHours()}`.slice(-2)
		const mm = `0${now.getMinutes()}`.slice(-2)
		const ss = `0${now.getSeconds()}`.slice(-2)
		const year = now.getFullYear()
		const month = `0${now.getMonth() + 1}`.slice(-2)
		const day = `0${now.getDate()}`.slice(-2)
		const hhmm = hh + ':' + mm
		const hhmmss = hhmm + ':' + ss
		const ts = Math.floor(now.getTime() / 1000)

		this.internalModule.setVariables({
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
		})
	}
}
