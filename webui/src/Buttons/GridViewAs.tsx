import { useCallback, useContext, useMemo, useState } from 'react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { useComputed } from '../util.js'
import { DropdownChoice } from '@companion-module/base'
import { ClientSurfaceItem, SurfaceLayoutSchema } from '@companion-app/shared/Model/Surfaces.js'
import { cloneDeep } from 'lodash-es'

export enum GridViewSpecialSurface {
	None = '__none__',
	Custom = '__custom__',
}

interface GridViewAsStore {
	surfaceId: GridViewSpecialSurface | string
	custom: {
		type: string
		xOffset: number
		yOffset: number
	}
}

const DEFAULT_STORED_VALUE = {
	surfaceId: GridViewSpecialSurface.None,
	custom: {
		type: 'streamdeck-xl',
		xOffset: 0,
		yOffset: 0,
	},
}

export interface GridViewSelectedSurfaceInfo {
	id: GridViewSpecialSurface | string
	type: string
	xOffset: number
	yOffset: number
	layout: SurfaceLayoutSchema | null
}

export interface GridViewAsController {
	selectedSurface: GridViewSelectedSurfaceInfo
	surfaceChoices: DropdownChoice[]

	setSelectedSurface: (surface: GridViewSpecialSurface | string) => void

	setCustomType: (type: string) => void
	setCustomXOffset: (xOffset: number) => void
	setCustomYOffset: (yOffset: number) => void
}

export function useGridViewAs(): GridViewAsController {
	const { surfaces } = useContext(RootAppStoreContext)

	const [storedData, setStoredData] = useState<GridViewAsStore>(() => {
		try {
			// // load the cached value, or start with default
			const storedValue = JSON.parse(window.localStorage.getItem(`grid-view-as`) + '')

			// Load and ensure it looks sane
			return {
				surfaceId: storedValue.surfaceId || DEFAULT_STORED_VALUE.surfaceId,
				custom: {
					type: storedValue.custom.type || DEFAULT_STORED_VALUE.custom.type,
					xOffset: Number(storedValue.custom.xOffset) || DEFAULT_STORED_VALUE.custom.xOffset,
					yOffset: Number(storedValue.custom.yOffset) || DEFAULT_STORED_VALUE.custom.yOffset,
				},
			}
		} catch {
			// Ignore the error,
			return cloneDeep(DEFAULT_STORED_VALUE)
		}
	})
	const updateStoredData = useCallback(
		(update: (oldValue: GridViewAsStore) => GridViewAsStore) => {
			return setStoredData((oldValue) => {
				const newValue = update(oldValue)

				// Cache the value for future page loads
				window.localStorage.setItem(`grid-view-as`, JSON.stringify(newValue))

				return newValue
			})
		},
		[setStoredData]
	)

	const selectedSurfaceIsValid =
		storedData.surfaceId === GridViewSpecialSurface.None ||
		storedData.surfaceId === GridViewSpecialSurface.Custom ||
		surfaces.getSurfaceItem(storedData.surfaceId) !== undefined
	if (!selectedSurfaceIsValid) {
		// If the selected surface is invalid, reset to the default
		updateStoredData((oldStore) => ({ ...oldStore, surfaceId: GridViewSpecialSurface.None }))
	}

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
		const updateCustomValue = (update: (oldValue: GridViewAsStore['custom']) => GridViewAsStore['custom']) => {
			updateStoredData((oldStore) => {
				if (oldStore.surfaceId !== GridViewSpecialSurface.Custom) return oldStore

				return {
					...oldStore,
					custom: update(oldStore.custom),
				}
			})
		}

		return {
			setSelectedSurface: (surfaceId: GridViewSpecialSurface | string): void => {
				updateStoredData((oldStore) => ({
					...oldStore,
					surfaceId,
				}))
			},

			setCustomType: (type: string): void => {
				updateCustomValue((oldCustom) => {
					return {
						...oldCustom,
						type,
					}
				})
			},
			setCustomXOffset: (xOffset: number): void => {
				updateCustomValue((oldCustom) => {
					return {
						...oldCustom,
						xOffset,
					}
				})
			},
			setCustomYOffset: (yOffset: number): void => {
				updateCustomValue((oldCustom) => {
					return {
						...oldCustom,
						yOffset,
					}
				})
			},
		}
	}, [updateStoredData])

	const selectedSurfaceInfo = surfaces.getSurfaceItem(storedData.surfaceId)

	return {
		...controller,
		selectedSurface: getSelectedSurface(storedData, selectedSurfaceInfo, surfaces.layouts),
		surfaceChoices,
	}
}

function getSelectedSurface(
	storedData: GridViewAsStore,
	surfaceInfo: ClientSurfaceItem | undefined,
	surfaceLayouts: SurfaceLayoutSchema[]
): GridViewSelectedSurfaceInfo {
	switch (storedData.surfaceId) {
		case GridViewSpecialSurface.None:
			return {
				id: storedData.surfaceId,
				type: 'Full Grid',
				xOffset: 0,
				yOffset: 0,
				layout: null,
			}
		case GridViewSpecialSurface.Custom:
			return {
				id: storedData.surfaceId,
				type: storedData.custom.type,
				xOffset: storedData.custom.xOffset,
				yOffset: storedData.custom.yOffset,
				layout: surfaceLayouts.find((layout) => layout.id === storedData.custom.type) ?? null,
			}
		default:
			return {
				id: storedData.surfaceId,
				type: surfaceInfo?.type ?? 'Unknown',
				xOffset: surfaceInfo?.xOffset ?? 0,
				yOffset: surfaceInfo?.yOffset ?? 0,
				layout: surfaceInfo?.layout ?? null,
			}
	}
}
