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

export class SurfaceLayoutRegistry {
	/**
	 * The list of known surface layouts
	 * @type {import("@companion-app/shared/Model/Surfaces.js").SurfaceLayoutSchema[]}
	 * @access private
	 * @readonly
	 */
	#layouts = []

	constructor() {
		this.#addStreamdeckLayouts()
	}

	#addStreamdeckLayouts() {
		this.#layouts.push(
			{
				id: 'streamdeck-15',
				name: 'Stream Deck: Original',
				rows: 3,
				columns: 5,
			},
			{
				id: 'streamdeck-xl',
				name: 'Stream Deck: XL',
				rows: 4,
				columns: 8,
			}
			// TODO - add more layouts
		)
	}

	/**
	 * @returns {import("@companion-app/shared/Model/Surfaces.js").SurfaceLayoutSchema[]}
	 */
	getLayouts() {
		return this.#layouts
	}
}
