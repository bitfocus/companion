import { useCallback, useState, type MouseEventHandler } from 'react'
import { type MenuItemProps } from './ActionMenu'

// convenience object
export const MenuSeparator: MenuItemProps = {
	isSeparator: true,
}

export interface ContextMenuState {
	open: boolean
	onOpenChange: (open: boolean) => void
	position: { x: number; y: number }
	onContextMenu: MouseEventHandler<HTMLDivElement>
	menuItems: MenuItemProps[]
}

/*
	useContextMenuState provides onContextMenu for consumption by ContextMenu's parent container
	It also manages positioning and visibility, and must be passed to the ContextMenu component.

	* menuItems: the menu description
	Note that menuItems is supplied as a pass-through purely to simplify the client syntax:

	const contextMenuItems = useMemo(() => [ ...menu items... ])
	const contextMenuProps = useContextMenuState(contextMenuItems)
	<div onContextMenu={contextMenuProps.onContextMenu}>
		<ContextMenu { ...contextMenuProps}/>
	</div>
*/
export function useContextMenuState(menuItems: MenuItemProps[]): ContextMenuState {
	const [open, setOpen] = useState(false)
	const [position, setPosition] = useState({ x: 0, y: 0 })

	const onContextMenu: MouseEventHandler<HTMLDivElement> = useCallback((e) => {
		// allow modifiers to suppress the context menu so we can inspect things in the browser
		// Also, doing it this way avoids worrying about mac command key vs. windows' windows key, etc.
		if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
			setOpen(false)
		} else {
			e.preventDefault()
			e.stopPropagation()
			setPosition({ x: e.clientX, y: e.clientY })
			setOpen(true)
		}
	}, [])

	return { open, onOpenChange: setOpen, position, onContextMenu, menuItems }
}
