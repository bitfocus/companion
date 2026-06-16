/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useRef } from 'react'

/**
 * Fallback height (px) used to reserve space for an expanded-but-never-rendered entity row
 * before any real measurement (of it, or of another entity sharing its definition) is available.
 */
export const DEFAULT_ESTIMATED_GRID_HEIGHT = 150

export interface EntityListHeightCache {
	/** Record the measured height of an entity's `editor-grid`, keyed both by entity id and definition. */
	set: (entityId: string, defKey: string, height: number) => void
	/** Best available height estimate: exact for this entity, else another entity of the same definition, else the default. */
	estimate: (entityId: string, defKey: string) => number
	/** Drop all cached measurements (e.g. when the list width changes and old heights are stale). */
	clear: () => void
}

const EntityListHeightCacheContext = createContext<EntityListHeightCache | null>(null)

export function useEntityListHeightCache(): EntityListHeightCache {
	const ctx = useContext(EntityListHeightCacheContext)
	if (!ctx) throw new Error('useEntityListHeightCache must be used within an EntityListHeightCacheProvider')
	return ctx
}

export function EntityListHeightCacheProvider({ children }: React.PropsWithChildren): React.JSX.Element {
	// Exact last-measured height per entity id
	const byEntityId = useRef<Map<string, number>>(new Map()).current
	// Last-measured height per definition (connection + type + definitionId), used as an estimate
	// for entities of the same definition that have not been rendered yet
	const byDefinition = useRef<Map<string, number>>(new Map()).current

	const cache = useMemo<EntityListHeightCache>(
		() => ({
			set: (entityId, defKey, height) => {
				if (!height) return
				byEntityId.set(entityId, height)
				byDefinition.set(defKey, height)
			},
			estimate: (entityId, defKey) =>
				byEntityId.get(entityId) ?? byDefinition.get(defKey) ?? DEFAULT_ESTIMATED_GRID_HEIGHT,
			clear: () => {
				byEntityId.clear()
				byDefinition.clear()
			},
		}),
		[byEntityId, byDefinition]
	)

	return <EntityListHeightCacheContext.Provider value={cache}>{children}</EntityListHeightCacheContext.Provider>
}
