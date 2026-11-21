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
import type { QuarantinedRender } from '@companion-app/shared/Model/RenderStall.js'
import type { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { DataCacheDefaultTable } from '../Data/Cache.js'
import type { DataStoreTableView } from '../Data/Tables/TableView.js'
import { makeReferencePlaceholder } from './ConvertGraphicsElements.js'
import { collectContentHashes } from './ConvertGraphicsElements/Util.js'

/** Where the quarantine is kept between runs */
export interface RenderQuarantineStore {
	load(): QuarantinedRender[]
	save(entries: QuarantinedRender[]): void
}

/** What is kept in the cache */
export interface CachedRenderQuarantine {
	/** The build the draws stalled on, as an update may fix them */
	build: string
	entries: QuarantinedRender[]
}

/**
 * Keeps the quarantine in the cache, so that a draw which stalls isn't drawn again after a restart, until an update
 */
export class CachedRenderQuarantineStore implements RenderQuarantineStore {
	readonly #table: Pick<DataStoreTableView<DataCacheDefaultTable>, 'get' | 'set'>
	readonly #build: string

	constructor(table: Pick<DataStoreTableView<DataCacheDefaultTable>, 'get' | 'set'>, build: string) {
		this.#table = table
		this.#build = build
	}

	load(): QuarantinedRender[] {
		const cached = this.#table.get('render_quarantine')
		if (!cached || cached.build !== this.#build || !Array.isArray(cached.entries)) return []
		return cached.entries
	}

	save(entries: QuarantinedRender[]): void {
		this.#table.set('render_quarantine', { build: this.#build, entries })
	}
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
 * at each size it is shown at and each time it is redrawn, until the render threads have all stalled. Kept until an
 * update, as a restart would only stall again
 */
export class RenderQuarantine extends EventEmitter<RenderQuarantineEvents> {
	readonly #store: RenderQuarantineStore
	readonly #entries: Map<string, QuarantinedRender>

	constructor(store: RenderQuarantineStore) {
		super()

		this.#store = store
		this.#entries = new Map(store.load().map((entry) => [entry.key, entry]))
	}

	has(key: string): boolean {
		return this.#entries.has(key)
	}

	/**
	 * @returns Whether it was added, rather than already quarantined
	 */
	add(entry: QuarantinedRender): boolean {
		if (this.#entries.has(entry.key)) return false

		this.#entries.set(entry.key, entry)
		this.#store.save(this.list())
		this.emit('changed')
		return true
	}

	/**
	 * Allow something to be drawn again
	 * @returns Whether it was quarantined
	 */
	remove(key: string): boolean {
		if (!this.#entries.delete(key)) return false

		this.#store.save(this.list())
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
