import { useLayoutEffect, useState } from 'react'
import { CDropdownMenu } from '@coreui/react'
import { useWindowSize } from 'usehooks-ts'
import { MenuItem } from './ActionMenu'
import { type ContextMenuProps } from './useContextMenuProps'

// CDropdownMenu accepts ref but CoreUI didn't explicitly export the type so, we just let TS know:
// Create a typed version of CDropdownMenu that explicitly accepts a ref
const CDropdownMenuWithRef = CDropdownMenu as unknown as React.ForwardRefExoticComponent<
	React.ComponentPropsWithoutRef<typeof CDropdownMenu> & React.RefAttributes<HTMLDivElement>
>

export const ContextMenu = ({ visible, position, menuRef, menuItems = [] }: ContextMenuProps): React.JSX.Element => {
	// All the code before the return statement is to make sure the menu doesn't get clipped.
	//  note that the CSS transform doesn't work on the outer div. I don't know why.
	const win = useWindowSize()

	const [coords, setCoords] = useState({ x: 0, y: 0 })

	useLayoutEffect(() => {
		// Only run if the menu is supposed to be visible
		if (!visible || !menuRef.current) return

		const menuDims = menuRef.current.getBoundingClientRect() // Total dims including padding/border; alt: offsetHeight/Width

		// Ensure menu stays in window (if window is shorter/narrower than menu, it will be the best it can be w/o scrolling... but this is an unlikely edge-case)
		const margin = 5 // or use something in CSS?
		const x = position.x - Math.max(0, position.x + menuDims.width + margin - win.width)
		const y = position.y - Math.max(0, position.y + menuDims.height + margin - win.height)

		// console.log(
		// 	`pos: ${position.x}, ${position.y}; menu: ${menuDims.width}, ${menuDims.height}; coords: ${x}, ${y}; win: ${win.width}, ${win.height}`
		// )
		setCoords({ x, y })
	}, [position.x, position.y, visible, win.width, win.height, menuRef]) // Only re-run when the click moves (or window size changes)

	const noIcons = menuItems.every((item) => 'isSeparator' in item || item.icon === undefined)

	// We use <div> below because CDropdown prevented interactive positioning or failed to show entirely.
	// The following was arrived at with a bit of help from Google's AI, though it too suggested many wrong ways first.
	// 1. We skip <CDropdown> to avoid Popper.js interference (even though setting popper={false} and portal={true} did not help).
	// 2. We add the 'display' style-prop to DropdownMenu to force it to render/control visibility.
	return (
		<div
			style={{
				position: 'fixed', // Use 'fixed' so it stays put regardless of scroll
				top: coords.y, // offset from top of parent; note that this has to be in the div, not the CDropdown
				left: coords.x,
				visibility: visible ? 'visible' : 'hidden', // probably not necessary, but doesn't hurt
				pointerEvents: visible ? 'auto' : 'none', // Prevent clicks while hidden
				zIndex: 2000, // --cui-sidebar-zindex is 1035, the highest standard cui zindex is 1070 (https://coreui.io/v1/docs/layout/overview/)
			}}
			className="context-menu"
		>
			<CDropdownMenuWithRef ref={menuRef} style={{ display: visible ? 'block' : 'none' } /* we need it here */}>
				{menuItems.map((option, idx) => (
					<MenuItem key={option.id || `item-${idx}`} data={noIcons ? { ...option, icon: 'none' } : option} />
				))}
			</CDropdownMenuWithRef>
		</div>
	)
}
