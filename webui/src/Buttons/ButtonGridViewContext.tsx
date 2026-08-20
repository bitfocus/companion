import { createContext, useContext } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { GridButtonModifiers } from './GridButtonPreview.js'

/**
 * Everything a cell on the main editing grid needs in order to interpret a gesture.
 *
 * This is per grid instance rather than app-wide on purpose: it is what lets two grids (eg. two
 * pages side by side) each keep their own interaction state.
 */
export interface ButtonGridView {
	/** Clicking a button fires it for real, rather than selecting it */
	pressMode: boolean

	onPress: (location: ControlLocation, isDown: boolean) => void
	onTap: (location: ControlLocation, modifiers: GridButtonModifiers) => void
	onContextMenu: (location: ControlLocation, x: number, y: number) => void
}

const ButtonGridViewContext = createContext<ButtonGridView | null>(null)

export const ButtonGridViewProvider = ButtonGridViewContext.Provider

export function useButtonGridView(): ButtonGridView {
	const view = useContext(ButtonGridViewContext)
	if (!view) throw new Error('useButtonGridView must be used inside a ButtonGridViewProvider')
	return view
}
