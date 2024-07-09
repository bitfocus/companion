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

import { PRODUCTS as XKeysProducts } from 'xkeys'
import { contourShuttleXpressInfo, contourShuttleProV1Info, contourShuttleProV2Info } from './USB/ContourShuttle.js'

export class SurfaceLayoutRegistry {
	/**
	 * The list of known surface layouts
	 * @type {import("@companion-app/shared/Model/Surfaces.js").SurfaceLayoutSchema[]}
	 * @access private
	 * @readonly
	 */
	#layouts = []

	constructor() {
		this.#addCountourShuttleLayouts()
		this.#addStreamdeckLayouts()
		this.#addLoupedeckLayouts()
		this.#addInfinittonLayouts()
		this.#addVideohubLayouts()
		this.#addXKeysLayouts()

		// Sort by name
		this.#layouts.sort((a, b) => a.name.localeCompare(b.name))
	}

	#addCountourShuttleLayouts() {
		this.#layouts.push(
			{
				id: 'contour-shuttle-xpress',
				name: 'Contour Shuttle Xpress',
				type: 'grid',
				rows: contourShuttleXpressInfo.totalRows,
				columns: contourShuttleXpressInfo.totalCols,
			},
			{
				id: 'contour-shuttle-pro-v1',
				name: 'Contour Shuttle Pro v1',
				type: 'grid',
				rows: contourShuttleProV1Info.totalRows,
				columns: contourShuttleProV1Info.totalCols,
			},
			{
				id: 'contour-shuttle-pro-v2',
				name: 'Contour Shuttle Pro v2',
				type: 'grid',
				rows: contourShuttleProV2Info.totalRows,
				columns: contourShuttleProV2Info.totalCols,
			}
		)
	}

	#addStreamdeckLayouts() {
		this.#layouts.push(
			{
				id: 'streamdeck-15',
				name: 'Elgato Streamdeck Original',
				type: 'grid',
				rows: 3,
				columns: 5,
			},
			{
				id: 'streamdeck-xl',
				name: 'Elgato Streamdeck XL',
				type: 'grid',
				rows: 4,
				columns: 8,
			},
			{
				id: 'streamdeck-mini',
				name: 'Elgato Streamdeck Mini',
				type: 'grid',
				rows: 2,
				columns: 3,
			},
			{
				id: 'streamdeck-plus',
				name: 'Elgato Streamdeck +',
				type: 'grid',
				rows: 4,
				columns: 4,
			},
			{
				id: 'streamdeck-pedal',
				name: 'Elgato Streamdeck Pedal',
				type: 'grid',
				rows: 1,
				columns: 3,
			},
			{
				id: 'streamdeck-neo',
				name: 'Elgato Streamdeck Neo',
				type: 'grid',
				rows: 3,
				columns: 4,
			}
		)
	}

	#addLoupedeckLayouts() {
		this.#layouts.push(
			{
				id: 'loupedeck-live',
				name: 'Loupedeck Live',
				type: 'grid',
				rows: 4,
				columns: 8,
			},
			{
				id: 'loupedeck-live-s',
				name: 'Loupedeck Live S',
				type: 'grid',
				rows: 3,
				columns: 7,
			},
			{
				id: 'razer-stream-controller',
				name: 'Razer Stream Controller',
				type: 'grid',
				rows: 4,
				columns: 8,
			},
			{
				id: 'razer-stream-controller-x',
				name: 'Razer Stream Controller X',
				type: 'grid',
				rows: 3,
				columns: 5,
			},
			{
				id: 'loupedeck-ct',
				name: 'Loupedeck CT',
				type: 'grid',
				rows: 8, // TODO verify
				columns: 8,
			}
		)
	}

	#addInfinittonLayouts() {
		this.#layouts.push({
			id: 'infinitton-idisplay',
			name: 'Infinitton idisplay',
			type: 'grid',
			rows: 3,
			columns: 5,
		})
	}

	#addVideohubLayouts() {
		this.#layouts.push({
			id: 'blackmagic-videohub-smart-control',
			name: 'Videohub Smart Control',
			type: 'grid',
			rows: 2,
			columns: 20,
		})
	}

	#addXKeysLayouts() {
		for (const [id, product] of Object.entries(XKeysProducts)) {
			this.#layouts.push({
				id: `xkeys-${id}`,
				name: `XKeys ${product.name}`,
				type: 'grid',

				rows: product.rowCount,
				columns: product.colCount,
			})
		}
	}

	/**
	 * @returns {import("@companion-app/shared/Model/Surfaces.js").SurfaceLayoutSchema[]}
	 */
	getLayouts() {
		return this.#layouts
	}
}
