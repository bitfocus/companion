import { EventEmitter } from 'node:events'
import { z } from 'zod'
import { LINK_NO_PERMISSIONS, type LinkPermissions } from '@companion-app/shared/Model/Link.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'

/** Kinds of things added later default to not shared */
const StoredPermissionsSchema = z.object({ buttons: z.boolean().default(false) })

export interface LinkPermissionStoreEvents {
	changed: [peerId: string, permissions: LinkPermissions]
}

/**
 * What this installation lets each other installation use, chosen by the user, by Link id. As a Link id is proven by
 * the transports, this is the same over every transport the installation is reachable on. Nothing is shared with an
 * installation until the user says so.
 */
export class LinkPermissionStore extends EventEmitter<LinkPermissionStoreEvents> {
	readonly #table: DataStoreTableView<Record<string, LinkPermissions>>
	/** What is in the table, as it is checked for every message */
	readonly #permissions = new Map<string, LinkPermissions>()

	constructor(db: DataDatabase) {
		super()
		this.setMaxListeners(0)
		this.#table = db.getTableView('link_permissions')

		for (const [peerId, raw] of Object.entries(this.#table.all())) {
			const stored = StoredPermissionsSchema.safeParse(raw)
			if (stored.success) this.#permissions.set(peerId, stored.data)
		}
	}

	get(peerId: string): LinkPermissions {
		return { ...(this.#permissions.get(peerId) ?? LINK_NO_PERMISSIONS) }
	}

	set(peerId: string, permissions: LinkPermissions): void {
		this.#table.set(peerId, permissions)
		this.#permissions.set(peerId, { ...permissions })
		this.emit('changed', peerId, permissions)
	}

	/** Stop sharing anything with an installation, and forget what was */
	delete(peerId: string): void {
		if (!this.#permissions.delete(peerId)) return
		this.#table.delete(peerId)
		this.emit('changed', peerId, { ...LINK_NO_PERMISSIONS })
	}

	/** Forget what is shared with any installation not in the list, so nothing is kept for one that can't be seen */
	retainOnly(peerIds: ReadonlySet<string>): void {
		for (const peerId of Object.keys(this.#table.all())) {
			if (peerIds.has(peerId)) continue
			this.#table.delete(peerId)
			this.#permissions.delete(peerId)
		}
	}
}
