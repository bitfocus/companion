import { useCallback, useEffect, useState, type MouseEventHandler } from 'react'
import { type MenuItemData } from './ActionMenu'

// convenience object
export const MenuSeparator: MenuItemData = {
	isSeparator: true,
}

// technically, ContextMenuProps is private to the ContextMenu code,
// but since we have to split the hook and component into two files, it needs to be exported here.
export interface ContextMenuProps {
	visible: boolean
	position: { x: number; y: number }
	onContextMenu: MouseEventHandler<HTMLDivElement>
	menuItems: MenuItemData[]
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
export function useContextMenuState(menuItems: MenuItemData[]): ContextMenuProps {
	const [visible, setVisible] = useState(false)
	const [position, setPosition] = useState({ x: 200, y: 200 })

	useEffect(() => {
		// Close menu when clicking anywhere else
		const handleOutsideClick = () => setVisible(false)

		document.addEventListener('click', handleOutsideClick)
		document.addEventListener('auxclick', handleOutsideClick)
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') handleOutsideClick()
		}
		document.addEventListener('keydown', handleEsc)

		return () => {
			document.removeEventListener('click', handleOutsideClick)
			document.removeEventListener('auxclick', handleOutsideClick)
			document.removeEventListener('keydown', handleEsc)
		}
	}, [setVisible])

	const onContextMenu: MouseEventHandler<HTMLDivElement> = useCallback(
		(e) => {
			// allow modifiers to suppress the context menu so we can inspect things in the browser
			// Also, doing it this way avoids worrying about mac command key vs. windows' windows key, etc.
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
				setVisible(false) // in case menu was open at the time
			} else {
				e.preventDefault()
				e.stopPropagation()
				//console.log(JSON.stringify(e)) // throws error! (circular reference)
				setPosition({ x: e.clientX, y: e.clientY })
				setVisible(true)
			}
		},
		[setPosition, setVisible]
	)

	return { visible, position, onContextMenu, menuItems }
}
