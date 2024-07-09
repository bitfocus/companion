import { useContext, useMemo, useState } from 'react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { useComputed } from '../util.js'
import { DropdownChoice } from '@companion-module/base'
import { ClientSurfaceItem } from '@companion-app/shared/Model/Surfaces.js'

export const ZOOM_MIN = 20
export const ZOOM_MAX = 200
export const ZOOM_STEP = 10

export enum GridViewSpecialSurface {
	None = '__none__',
	Custom = '__custom__',
}

export interface GridViewSelectedSurfaceInfo {
	id: GridViewSpecialSurface | string
	type: string
	xOffset: number
	yOffset: number
}

export interface GridViewAsController {
	selectedSurface: GridViewSelectedSurfaceInfo
	surfaceChoices: DropdownChoice[]

	setSelectedSurface: (surface: GridViewSpecialSurface | string) => void
}

function storeZoomValue(id: string, value: number) {
	// Cache the value for future page loads
	window.localStorage.setItem(`grid-zoom-scale:${id}`, value + '')
}

export function useGridViewAs(): GridViewAsController {
	const { surfaces } = useContext(RootAppStoreContext)

	// const [gridZoom, setGridZoom] = useState(() => {
	// 	// load the cached value, or start with default
	// 	const storedZoom = Number(window.localStorage.getItem(`grid-zoom-scale:${id}`))
	// 	return storedZoom && !isNaN(storedZoom) ? storedZoom : 100
	// })

	const [selectedSurfaceId, setSelectedSurfaceId] = useState<GridViewSpecialSurface | string>(
		GridViewSpecialSurface.None
	)

	const surfaceChoices = useComputed(() => {
		return [
			{
				id: GridViewSpecialSurface.None,
				label: 'Full Grid',
			},
			{
				id: GridViewSpecialSurface.Custom,
				label: 'Custom Surface',
			},
			...Array.from(surfaces.store.values()).flatMap((surfaceGroup): DropdownChoice[] =>
				surfaceGroup.surfaces.map((surface) => ({
					id: surface.id,
					label: surface.displayName,
				}))
			),
		]
	}, [surfaces])

	const controller = useMemo<Omit<GridViewAsController, 'selectedSurface' | 'surfaceChoices'>>(() => {
		return {
			setSelectedSurface: (surfaceId: GridViewSpecialSurface | string): void => {
				setSelectedSurfaceId(surfaceId)
			},
		}
	}, [])

	const selectedSurfaceInfo = surfaces.getSurfaceItem(selectedSurfaceId)

	return {
		...controller,
		selectedSurface: {
			id: selectedSurfaceId,
			type: getSurfaceType(selectedSurfaceId, selectedSurfaceInfo),
			xOffset: selectedSurfaceInfo?.xOffset ?? 0,
			yOffset: selectedSurfaceInfo?.yOffset ?? 0,
		},
		surfaceChoices,
	}
}

function getSurfaceType(id: GridViewSpecialSurface | string, surfaceInfo: ClientSurfaceItem | undefined): string {
	switch (id) {
		case GridViewSpecialSurface.None:
			return 'Full Grid'
		case GridViewSpecialSurface.Custom:
			return 'Custom' // TODO is this needed?
		default:
			return surfaceInfo?.type ?? 'Unknown'
	}
}
