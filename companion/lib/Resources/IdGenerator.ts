import { nanoid } from 'nanoid'

/** Allocates the ids a conversion needs for whatever it produces - entities, elements, style overrides. */
export type IdGenerator = () => string

/** Fresh random ids, for output that becomes live control data. */
export const randomIdGenerator: IdGenerator = () => nanoid()

/**
 * Deterministic ids, numbered in call order from `prefix`. For output that is content-hashed to detect
 * change: a conversion is a pure function of its input, so the same input yields the same ids.
 */
export function createStableIdGenerator(prefix: string): IdGenerator {
	let nextIndex = 0
	return () => `${prefix}_${nextIndex++}`
}
