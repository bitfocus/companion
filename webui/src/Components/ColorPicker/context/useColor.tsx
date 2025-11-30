import { debounce } from 'lodash-es'
import React, { type Context, createContext, useContext, useEffect, useMemo } from 'react'
import type { Color, ColorResult, HexColor, HsvColor, RgbColor } from '../colors'
import { ColorsStore } from './store'
import { colord } from 'colord'

export type OnChangeFn<TColor> = (color: TColor, event: React.SyntheticEvent | MouseEvent) => void

export interface ColorContextType {
	colors: ColorsStore
	changeRgbColor: OnChangeFn<Partial<RgbColor>>
	changeHsvColor: OnChangeFn<Partial<HsvColor>>
	changeHexColor: OnChangeFn<HexColor>
}

const ColorContext = createContext<ColorContextType | undefined>(undefined)

export interface ColorProviderProps {
	/** Debounced version of `onChange`. Called after 100ms of no change */
	onChangeComplete?: (color: ColorResult) => void

	/**
	 * Called _every_ time the color changes, ex. when dragging to select a color.
	 * Use `onChangeComplete` for a debounced value (only called once picking a color is complete)
	 */
	onChange?: (color: ColorResult, event: React.SyntheticEvent | MouseEvent) => void

	/** Allows you to control the color yourself */
	color?: Color

	/** Default color */
	defaultColor?: Color
}

export function ColorProvider({
	onChangeComplete,
	onChange,
	color: passedColor,
	defaultColor = {
		h: 250,
		s: 0.5,
		l: 0.2,
		a: 1,
	},
	children,
}: React.PropsWithChildren<ColorProviderProps>): React.JSX.Element {
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const store = useMemo(() => new ColorsStore(defaultColor), [])

	// Update store if passed color changes
	useEffect(() => {
		if (passedColor) store.update(colord(passedColor))
	}, [store, passedColor])

	const handler = (fn: any, data: any, event: any) => fn(data, event)
	const debouncedChangeHandler = useMemo(() => debounce(handler, 100), [])

	const contextValue = useMemo<ColorContextType>(
		() => ({
			colors: store,
			changeRgbColor: (newColor: Partial<RgbColor>, event: React.SyntheticEvent | MouseEvent) => {
				const newState = store.update(colord({ ...store.rgb, ...newColor }))

				if (onChangeComplete) debouncedChangeHandler(onChangeComplete, newState, event)
				onChange?.(newState, event)
			},
			changeHsvColor: (newColor: Partial<HsvColor>, event: React.SyntheticEvent | MouseEvent) => {
				const newState = store.update(colord({ ...store.hsv, ...newColor }))

				if (onChangeComplete) debouncedChangeHandler(onChangeComplete, newState, event)
				onChange?.(newState, event)
			},
			changeHexColor: (newColor: HexColor, event: React.SyntheticEvent | MouseEvent) => {
				const newState = store.update(colord(newColor))

				if (onChangeComplete) debouncedChangeHandler(onChangeComplete, newState, event)
				onChange?.(newState, event)
			},
		}),
		[store, onChange, onChangeComplete, debouncedChangeHandler]
	)

	return <ColorContext.Provider value={contextValue}>{children}</ColorContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useColor = (): ColorContextType => useContext(ColorContext as Context<ColorContextType>)
