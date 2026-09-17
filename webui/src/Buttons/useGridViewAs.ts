import { useSubscription } from '@trpc/tanstack-react-query'
import { useCallback, useContext, useMemo, useState } from 'react'
import type {
	ClientSurfaceLayoutItem,
	ClientSurfaceModelItem,
	SurfaceModelsUpdate,
} from '@companion-app/shared/Model/Surfaces.js'
import { useLocalStorage } from '~/Hooks/useLocalStorage.js'
import { trpc } from '~/Resources/TRPC.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import {
	applySurfaceModelChanges,
	DEFAULT_GRID_VIEW_AS_STATE,
	findSurfaceModelChoice,
	GRID_VIEW_AS_OFFSET_LIMIT,
	GRID_VIEW_AS_STORAGE_KEY,
	parseStoredGridViewAs,
	resolveGridViewAs,
	surfaceModelChoices,
	type GridViewAsModelChoice,
	type GridViewAsResolution,
	type GridViewAsSelection,
	type GridViewAsState,
	type KnownSurfacePlacement,
} from './GridViewAs.js'
import { useGridViewAsFlag } from './GridViewAsFlag.js'

export interface GridViewAsController {
	/** Whether the feature is turned on for this install at all. Everything else is moot while it is not */
	readonly available: boolean

	readonly state: GridViewAsState
	readonly resolution: GridViewAsResolution

	/**
	 * Every surface, whether or not it is plugged in right now. One whose layout is not yet known is
	 * offered but disabled, its label saying so - present, so it is not mysteriously missing, but not
	 * choosable, so choosing it cannot land on a view which shows nothing.
	 */
	readonly surfaceChoices: { id: string; label: string; disabled: boolean }[]
	/** Every model of surface which could be viewed as, whether or not one has ever been here */
	readonly modelChoices: GridViewAsModelChoice[]
	/** Which of `modelChoices` the current selection names, if it names one */
	readonly selectedModelChoice: GridViewAsModelChoice | null

	setEnabled: (enabled: boolean) => void
	setSelection: (selection: GridViewAsSelection) => void
	/** Choose a model of surface, keeping wherever the last one was put */
	setModelChoice: (choice: GridViewAsModelChoice) => void
	setOffset: (offset: { rows: number; columns: number }) => void
}

/** The id the surface dropdown uses for "not one of these, a model of surface" */
export const GRID_VIEW_AS_CUSTOM_ID = '__custom__'

/** The id it uses while nothing has been chosen at all */
export const GRID_VIEW_AS_NOTHING_ID = ''

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

	// Gated while the feature is being finished, per browser like the selection itself
	const [available] = useGridViewAsFlag()

	// Only subscribed while something is looking at the grid, because the layouts are much larger than
	// they are volatile - every control of every surface Companion has ever seen
	const [layoutItems, setLayoutItems] = useState<Record<string, ClientSurfaceLayoutItem>>({})
	useSubscription(
		trpc.surfaces.watchSurfaceLayouts.subscriptionOptions(undefined, {
			enabled: available,
			onData: (data) => setLayoutItems(data as Record<string, ClientSurfaceLayoutItem>),
			onError: (error) => {
				console.error('Failed to subscribe to surface layouts:', error)
				setLayoutItems({})
			},
		})
	)

	const layouts = useMemo(() => new Map(Object.entries(layoutItems)), [layoutItems])

	// The models the plugins declare, plugged in or not. Streamed as diff ops and folded into a map here.
	const [modelItems, setModelItems] = useState<Record<string, ClientSurfaceModelItem>>({})
	useSubscription(
		trpc.surfaces.watchSurfaceModels.subscriptionOptions(undefined, {
			enabled: available,
			onData: (changes) => setModelItems((old) => applySurfaceModelChanges(old, changes as SurfaceModelsUpdate[])),
			onError: (error) => {
				console.error('Failed to subscribe to surface models:', error)
				setModelItems({})
			},
		})
	)

	const models = useMemo(() => new Map(Object.entries(modelItems)), [modelItems])

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

	// Just the surfaces themselves; the popover adds the choices which are not one of them. A surface
	// whose layout we have never captured cannot be drawn, so it is offered disabled with the way to
	// fix it in its label, rather than left choosable to no effect.
	const surfaceChoices = useComputed(
		() =>
			Array.from(surfaces.store.values()).flatMap((group) =>
				group.surfaces.map((surface) => {
					const known = layouts.has(surface.id)
					return {
						id: surface.id,
						label: known ? surface.displayName : `${surface.displayName} - layout not available`,
						disabled: !known,
					}
				})
			),
		[surfaces, layouts]
	)

	const modelChoices = useMemo(() => surfaceModelChoices(models), [models])
	const selectedModelChoice = useMemo(
		() => findSurfaceModelChoice(modelChoices, stored.selection),
		[modelChoices, stored.selection]
	)

	const gridSize = useComputed(() => userConfig.properties?.gridSize ?? null, [userConfig])

	const resolution = useMemo(
		// Nothing can be placed anywhere until the grid's own size has arrived, so nor can a surface. A
		// view which is not available resolves to off, so the grid draws itself whole without every
		// caller having to ask whether the feature is on.
		() =>
			available && gridSize
				? resolveGridViewAs(stored, layouts, models, placements, gridSize)
				: { status: 'off' as const },
		[available, stored, layouts, models, placements, gridSize]
	)

	const setEnabled = useCallback((enabled: boolean) => setStored((oldState) => ({ ...oldState, enabled })), [setStored])

	// Choosing something to view as is asking to see it - having to then find the toggle would be a
	// second step which only ever has one sensible answer
	const setSelection = useCallback(
		(selection: GridViewAsSelection) => setStored((oldState) => ({ ...oldState, enabled: true, selection })),
		[setStored]
	)

	// Changing which model is being looked at should not move it back to the corner of the grid - where
	// it sits is the user's answer to a different question
	const setModelChoice = useCallback(
		(choice: GridViewAsModelChoice) =>
			setStored((oldState) => ({
				...oldState,
				enabled: true,
				selection: { ...choice.selector, offset: offsetOfSelection(oldState.selection) },
			})),
		[setStored]
	)

	const setOffset = useCallback(
		(offset: { rows: number; columns: number }) =>
			setStored((oldState) => {
				// A surface which exists brings its own offset, so there is nothing here to move
				const selection = oldState.selection
				if (selection?.type !== 'surfaceModel') return oldState

				return {
					...oldState,
					selection: {
						...selection,
						offset: { rows: clampOffset(offset.rows), columns: clampOffset(offset.columns) },
					},
				}
			}),
		[setStored]
	)

	return {
		available,
		state: stored,
		resolution,
		surfaceChoices,
		modelChoices,
		selectedModelChoice,
		setEnabled,
		setSelection,
		setModelChoice,
		setOffset,
	}
}

/** Where the current selection sits on the grid, for a selection which has a say in that */
function offsetOfSelection(selection: GridViewAsSelection | null): { rows: number; columns: number } {
	if (selection?.type === 'surfaceModel') return selection.offset

	return { rows: 0, columns: 0 }
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
