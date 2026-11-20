/*
 * This file is part of the Companion project
 * Copyright (c) 2026 Bitfocus AS
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { makeReferencePlaceholder } from './ConvertGraphicsElements.js'
import { collectContentHashes } from './ConvertGraphicsElements/Util.js'
import type { DrawnText } from './RenderTaskTimeout.js'

/** What a quarantined draw was of */
export interface QuarantinedRender {
	/** Identifies what was drawn, at any size, from renderQuarantineKey */
	readonly key: string
	/** What was being drawn, eg the button location */
	readonly description: string
	readonly texts: readonly DrawnText[]
	/** When it stalled, in ms */
	readonly time: number
}

/** Identifies what a button draws, at any size or state: two draw styles with the same key draw the same content */
export function renderQuarantineKey(drawStyle: Pick<DrawStyleLayeredButtonModel, 'drawType' | 'elements'>): string {
	return createHash('sha1')
		.update(JSON.stringify([drawStyle.drawType, collectContentHashes(drawStyle.elements)]))
		.digest('hex')
}

interface RenderQuarantineEvents {
	changed: []
}

/**
 * The draws which stalled a render thread, which are not drawn again, so that one bad button can't stall a thread
 * at each size it is shown at and each time it is redrawn, until the render threads have all stalled
 */
export class RenderQuarantine extends EventEmitter<RenderQuarantineEvents> {
	readonly #entries = new Map<string, QuarantinedRender>()

	has(key: string): boolean {
		return this.#entries.has(key)
	}

	/**
	 * @returns Whether it was added, rather than already quarantined
	 */
	add(entry: QuarantinedRender): boolean {
		if (this.#entries.has(entry.key)) return false

		this.#entries.set(entry.key, entry)
		this.emit('changed')
		return true
	}

	/**
	 * Allow something to be drawn again
	 * @returns Whether it was quarantined
	 */
	remove(key: string): boolean {
		if (!this.#entries.delete(key)) return false

		this.emit('changed')
		return true
	}

	list(): QuarantinedRender[] {
		return [...this.#entries.values()]
	}

	/**
	 * Replace what a draw style draws with a placeholder, if it is quarantined
	 */
	apply<T extends DrawStyleLayeredButtonModel>(drawStyle: T): T {
		if (this.#entries.size === 0 || !this.has(renderQuarantineKey(drawStyle))) return drawStyle

		return { ...drawStyle, elements: makeReferencePlaceholder('render-stalled', 'Draw\nstalled') }
	}
}
