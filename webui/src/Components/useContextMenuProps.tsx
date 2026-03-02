import { useCallback, useEffect, useRef, useState, type RefObject, type MouseEventHandler } from 'react'
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
	menuRef: RefObject<HTMLDivElement>
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
	const menuRef = useRef<HTMLDivElement>(null) // to get the ContextMenu's ref for event handling here

	useEffect(() => {
		// Close menu when clicking anywhere else
		const handleOutsideClick = (e?: Event) => {
			if (e && menuRef.current && menuRef.current.contains(e.target as Node)) {
				// Click was inside the menu: do not close it
				// and don't let it propagate to something that is eventually outside of the menu.
				e.stopPropagation()
				return
			}
			setVisible(false)
		}

		const handleInsideClick = (e?: Event) => {
			if (e && menuRef.current && menuRef.current.contains(e.target as Node)) {
				// allow propagation just to be safe so actions will trigger regardless of calling order.
				setVisible(false)
			}
		}

		// 'mouseup', 'click' and 'auxclick' will make the context-menu close on button-release in Linux/MacOS
		// because On macOS and Linux, the contextmenu event fires on mousedown (perhaps there's a way to
		// write handleOutsideClick to filter out clicks in the sidebar, but this would require passing a ref, at least.
		// just triggering on mousedown seems sufficient for now.)
		//  On Windows, the contextmenu event typically fires on mouseup, so it doesn't have this problem
		document.addEventListener('mousedown', handleOutsideClick)
		// document.addEventListener('auxclick', handleOutsideClick) // don't use this, see note above.
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') handleOutsideClick()
		}
		document.addEventListener('keydown', handleEsc)

		// because we transferred hiding (conditionally) to mousedown, we now need a mouseup handler
		// to close the menu when the user clicks inside it!
		document.addEventListener('mouseup', handleInsideClick)

		return () => {
			document.removeEventListener('mousedown', handleOutsideClick)
			document.removeEventListener('mouseup', handleOutsideClick)
			// document.removeEventListener('auxclick', handleOutsideClick) // don't use this
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

				setPosition({ x: e.clientX, y: e.clientY })
				setVisible(true)
			}
		},
		[setPosition, setVisible]
	)

	return { visible, position, onContextMenu, menuItems, menuRef }
}
