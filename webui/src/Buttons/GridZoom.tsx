import { useMemo, useRef, useState } from 'react'
import { safeSetLocalStorage } from '~/Helpers/SafeStorage.js'

export const ZOOM_MIN = 20
export const ZOOM_MAX = 200
export const ZOOM_STEP = 10

export interface GridZoomController {
	zoomIn: (noLimit?: boolean) => void
	zoomOut: (noLimit?: boolean) => void
	zoomReset: () => void
	setZoom: (value: number) => void
}

function storeZoomValue(id: string, value: number) {
	// Cache the value for future page loads
	safeSetLocalStorage(`grid-zoom-scale:${id}`, value + '')
}

export function useGridZoom(id: string): [GridZoomController, number] {
	const [gridZoom, setGridZoom] = useState(() => {
		// load the cached value, or start with default - also when storage is blocked, rather than failing the page
		try {
			const storedZoom = Number(window.localStorage.getItem(`grid-zoom-scale:${id}`))
			return storedZoom && !isNaN(storedZoom) ? storedZoom : 100
		} catch {
			return 100
		}
	})

	const controller = useMemo<GridZoomController>(() => {
		return {
			zoomIn: (noLimit) => {
				setGridZoom((oldValue) => {
					let newValue = oldValue + ZOOM_STEP
					if (!noLimit) newValue = Math.min(newValue, ZOOM_MAX)

					storeZoomValue(id, newValue)

					return newValue
				})
			},
			zoomOut: (noLimit) => {
				setGridZoom((oldValue) => {
					let newValue = oldValue - ZOOM_STEP
					if (!noLimit) newValue = Math.max(newValue, ZOOM_MIN)
					else newValue = Math.max(newValue, 10)

					storeZoomValue(id, newValue)

					return newValue
				})
			},
			zoomReset: () => {
				setGridZoom(100)
				storeZoomValue(id, 100)
			},
			setZoom: (value: number) => {
				setGridZoom(value)
				storeZoomValue(id, value)
			},
		}
	}, [id, setGridZoom])

	return [controller, gridZoom]
}

/**
 * The range fitting a surface keeps to. Fitting a very wide surface (a Stream Deck Studio) whole would draw its keys
 * too small to read, and fitting a small one (a pedal) would blow it up; both are better scrolled or left alone.
 */
export const FIT_ZOOM_MIN = 60
export const FIT_ZOOM_MAX = 100

/** The zoom which fits something this wide at 100% into the space there is, kept within the fit range */
export function fitZoom(widthAt100: number, availableWidth: number): number {
	if (!(widthAt100 > 0) || !(availableWidth > 0)) return FIT_ZOOM_MAX

	const fit = Math.floor((availableWidth / widthAt100) * 100)
	return Math.min(FIT_ZOOM_MAX, Math.max(FIT_ZOOM_MIN, fit))
}

/** A zoom as it is remembered: a level chosen by hand, or following the space as it changes */
export type StoredZoom = number | 'fit'

/** The fit mode of a zoom which has one, for the zoom control to offer */
export interface ZoomFit {
	/** Whether the zoom is following the space, rather than a level chosen by hand */
	active: boolean
	/** Go back to following the space */
	enable: () => void
}

export interface SurfaceZoom {
	controller: GridZoomController
	value: number
	fit: ZoomFit
}

function surfaceZoomStorageKey(key: string): string {
	return `grid-zoom-scale:surface:${key}`
}

/** Read back a remembered zoom, treating anything unrecognisable as fitting */
export function parseStoredZoom(raw: string | null): StoredZoom {
	if (raw === null || raw === 'fit') return 'fit'

	const value = Number(raw)
	return value > 0 && isFinite(value) ? value : 'fit'
}

function loadSurfaceZoom(key: string): StoredZoom {
	try {
		return parseStoredZoom(window.localStorage.getItem(surfaceZoomStorageKey(key)))
	} catch {
		return 'fit'
	}
}

/**
 * The zoom of the surface being viewed as, remembered for each kind of surface - a Neo and a Studio want very
 * different levels, so one shared between them is always wrong for one. A kind not seen before fits to the space,
 * and keeps fitting as the space changes, until a level is chosen by hand.
 *
 * Null when no surface is being viewed as, as the grid keeps its own zoom.
 */
export function useSurfaceZoom(key: string | null, fitValue: number): SurfaceZoom | null {
	// Every kind seen this session, so switching back does not have to read storage again
	const [settings, setSettings] = useState<Record<string, StoredZoom>>({})

	const setting: StoredZoom = key ? (settings[key] ?? loadSurfaceZoom(key)) : 'fit'
	const value = setting === 'fit' ? fitValue : setting

	// Read when a step lands rather than captured, so a step from fitting starts from the space as it is now
	const fitValueRef = useRef(fitValue)
	fitValueRef.current = fitValue

	// Only changes with the kind of surface, so what holds it - the wheel listener - is not redone at every step
	const controls = useMemo(() => {
		if (!key) return null

		// From the previous setting rather than one captured at render, so steps landing before a render all count
		const update = (next: (current: number) => StoredZoom) => {
			setSettings((old) => {
				const previous = old[key] ?? loadSurfaceZoom(key)
				const updated = next(previous === 'fit' ? fitValueRef.current : previous)
				safeSetLocalStorage(surfaceZoomStorageKey(key), String(updated))
				return { ...old, [key]: updated }
			})
		}

		const controller: GridZoomController = {
			// From wherever it is now, so zooming from fit carries on from the fitted level
			zoomIn: (noLimit) =>
				update((current) => (noLimit ? current + ZOOM_STEP : Math.min(current + ZOOM_STEP, ZOOM_MAX))),
			zoomOut: (noLimit) => update((current) => Math.max(current - ZOOM_STEP, noLimit ? 10 : ZOOM_MIN)),
			zoomReset: () => update(() => 100),
			setZoom: (next) => update(() => next),
		}
		return { controller, enableFit: () => update(() => 'fit') }
	}, [key])

	const fitActive = setting === 'fit'
	return useMemo<SurfaceZoom | null>(
		() =>
			controls && {
				value,
				controller: controls.controller,
				fit: { active: fitActive, enable: controls.enableFit },
			},
		[controls, value, fitActive]
	)
}
