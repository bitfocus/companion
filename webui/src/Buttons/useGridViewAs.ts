import { useSubscription } from '@trpc/tanstack-react-query'
import { useCallback, useContext, useMemo, useState } from 'react'
import type { ClientSurfaceLayoutItem } from '@companion-app/shared/Model/Surfaces.js'
import { useLocalStorage } from '~/Hooks/useLocalStorage.js'
import { trpc } from '~/Resources/TRPC.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import {
	DEFAULT_GRID_VIEW_AS_STATE,
	GRID_VIEW_AS_OFFSET_LIMIT,
	GRID_VIEW_AS_STORAGE_KEY,
	parseStoredGridViewAs,
	resolveGridViewAs,
	surfaceTypeChoicesFromLayouts,
	type GridViewAsResolution,
	type GridViewAsSelection,
	type GridViewAsState,
	type KnownSurfacePlacement,
} from './GridViewAs.js'

export interface GridViewAsController {
	readonly state: GridViewAsState
	readonly resolution: GridViewAsResolution

	/** Every surface which could be viewed as, whether or not it is plugged in right now */
	readonly surfaceChoices: { id: string; label: string }[]
	/** Every model of surface Companion has a layout for */
	readonly surfaceTypeChoices: { id: string; label: string }[]

	setEnabled: (enabled: boolean) => void
	setSelection: (selection: GridViewAsSelection) => void
	setOffset: (offset: { rows: number; columns: number }) => void
}

/** The id the surface dropdown uses for "not one of these, a model of surface" */
export const GRID_VIEW_AS_CUSTOM_ID = '__custom__'

/**
 * What the grid is being viewed as, and everything needed to change it.
 *
 * The selection is per browser rather than per Companion: it is a way of looking at the grid while
 * programming it, not a property of the config, and two people editing the same Companion have no
 * reason to be looking at the same surface.
 */
export function useGridViewAs(): GridViewAsController {
	const { surfaces, userConfig } = useContext(RootAppStoreContext)

	const [stored, setStored] = useLocalStorage<GridViewAsState>(
		GRID_VIEW_AS_STORAGE_KEY,
		DEFAULT_GRID_VIEW_AS_STATE,
		// Anything unrecognisable comes back as the view being off, rather than as a page which will not load
		{ deserializer: (raw) => parseStoredGridViewAs(safeParseJson(raw)) }
	)

	// Only subscribed while something is looking at the grid, because the layouts are much larger than
	// they are volatile - every control of every surface Companion has ever seen
	const [layoutItems, setLayoutItems] = useState<Record<string, ClientSurfaceLayoutItem>>({})
	useSubscription(
		trpc.surfaces.watchSurfaceLayouts.subscriptionOptions(undefined, {
			onData: (data) => setLayoutItems(data as Record<string, ClientSurfaceLayoutItem>),
			onError: (error) => {
				console.error('Failed to subscribe to surface layouts:', error)
				setLayoutItems({})
			},
		})
	)

	const layouts = useMemo(() => new Map(Object.entries(layoutItems)), [layoutItems])

	// Where each surface sits on the grid. Disconnected surfaces are in here too, so a view survives
	// the surface being unplugged - which is most of the point of being able to program for one.
	const placements = useComputed(() => {
		const placements = new Map<string, KnownSurfacePlacement>()

		for (const group of surfaces.store.values()) {
			for (const surface of group.surfaces) {
				placements.set(surface.id, {
					displayName: surface.displayName,
					offset: { rows: surface.offset?.rows ?? 0, columns: surface.offset?.columns ?? 0 },
					rotation: surface.rotation ?? 0,
					panelGridSize: surface.size,
				})
			}
		}

		return placements
	}, [surfaces])

	const surfaceChoices = useComputed(
		() => [
			{ id: GRID_VIEW_AS_CUSTOM_ID, label: 'A model of surface…' },
			...Array.from(surfaces.store.values()).flatMap((group) =>
				group.surfaces.map((surface) => ({ id: surface.id, label: surface.displayName }))
			),
		],
		[surfaces]
	)

	const surfaceTypeChoices = useMemo(() => surfaceTypeChoicesFromLayouts(layouts), [layouts])

	const gridSize = useComputed(() => userConfig.properties?.gridSize ?? null, [userConfig])

	const resolution = useMemo(
		// Nothing can be placed anywhere until the grid's own size has arrived, so nor can a surface
		() => (gridSize ? resolveGridViewAs(stored, layouts, placements, gridSize) : { status: 'off' as const }),
		[stored, layouts, placements, gridSize]
	)

	const setEnabled = useCallback((enabled: boolean) => setStored((oldState) => ({ ...oldState, enabled })), [setStored])

	const setSelection = useCallback(
		(selection: GridViewAsSelection) => setStored((oldState) => ({ ...oldState, selection })),
		[setStored]
	)

	const setOffset = useCallback(
		(offset: { rows: number; columns: number }) =>
			setStored((oldState) => {
				// A surface which exists brings its own offset, so there is nothing here to move
				if (oldState.selection.type !== 'surfaceType') return oldState

				return {
					...oldState,
					selection: {
						...oldState.selection,
						offset: { rows: clampOffset(offset.rows), columns: clampOffset(offset.columns) },
					},
				}
			}),
		[setStored]
	)

	return { state: stored, resolution, surfaceChoices, surfaceTypeChoices, setEnabled, setSelection, setOffset }
}

function clampOffset(value: number): number {
	if (!isFinite(value)) return 0

	return Math.min(GRID_VIEW_AS_OFFSET_LIMIT, Math.max(-GRID_VIEW_AS_OFFSET_LIMIT, Math.round(value)))
}

function safeParseJson(raw: string): unknown {
	try {
		return JSON.parse(raw)
	} catch {
		return null
	}
}
