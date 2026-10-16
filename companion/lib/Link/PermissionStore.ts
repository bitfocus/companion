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

	constructor(db: DataDatabase) {
		super()
		this.setMaxListeners(0)
		this.#table = db.getTableView('link_permissions')
	}

	get(peerId: string): LinkPermissions {
		const stored = StoredPermissionsSchema.safeParse(this.#table.get(peerId))
		return stored.success ? stored.data : { ...LINK_NO_PERMISSIONS }
	}

	set(peerId: string, permissions: LinkPermissions): void {
		this.#table.set(peerId, permissions)
		this.emit('changed', peerId, permissions)
	}
}
