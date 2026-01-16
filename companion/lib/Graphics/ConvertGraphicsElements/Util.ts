import type {
	ButtonGraphicsDrawBase,
	SomeButtonGraphicsDrawElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { createHash } from 'node:crypto'

/**
 * Compute a SHA256 hash of an object for cache key purposes.
 * Excludes 'id', 'contentHash' and 'children' from the hash as:
 * - id: already used as the cache key
 * - contentHash: we're computing it
 * - children: group hashes are shallow (children have their own hashes)
 */
export function computeElementContentHash<T extends Omit<ButtonGraphicsDrawBase, 'enabled' | 'opacity'>>(
	obj: T
): string {
	const hash = createHash('sha256')

	// Sort keys for deterministic hashing
	const keys = Object.keys(obj).sort()
	for (const key of keys) {
		// Skip id (used as cache key), contentHash (we're computing it), and children (shallow hash for groups)
		if (key === 'id' || key === 'contentHash' || key === 'children') continue

		const value = obj[key as keyof T]
		hash.update(key)
		hash.update(':')

		if (value === null) {
			hash.update('null')
		} else if (value === undefined) {
			hash.update('undefined')
		} else if (typeof value === 'object') {
			// For nested objects (including arrays), use JSON.stringify
			hash.update(JSON.stringify(value))
		} else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			hash.update(String(value))
		} else {
			// For any other type, convert to JSON
			hash.update(JSON.stringify(value))
		}
		hash.update(';')
	}

	return hash.digest('hex')
}

/**
 * Collect all contentHashes from a tree of draw elements recursively.
 * Uses structural markers to distinguish between elements at different nesting levels.
 * This ensures that moving an element in/out of a group produces a different cache key.
 */
export function collectContentHashes(elements: SomeButtonGraphicsDrawElement[]): string[] {
	const hashes: string[] = []

	for (const element of elements) {
		hashes.push(element.contentHash)

		// For groups, add structural markers and recurse into children
		if (element.type === 'group' && element.children) {
			hashes.push('[') // Start of group children marker
			hashes.push(...collectContentHashes(element.children))
			hashes.push(']') // End of group children marker
		}
	}

	return hashes
}
