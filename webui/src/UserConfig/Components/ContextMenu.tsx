import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CDropdownMenu } from '@coreui/react'
import { MenuItem } from '~/Layout/Header'
import { type ContextMenuProps } from './useContextMenuProps'

export const ContextMenu = ({ visible, position, menuItems = [] }: ContextMenuProps): React.JSX.Element => {
	// All the code before the return statement is to make sure the menu doesn't get clipped.
	//  note that the CSS transform doesn't work on the outer div. I don't know why.
	const ref = useRef<HTMLInputElement>(null)
	// store the result of useLayoutEffect:
	const [menuDims, setMenuDims] = useState({ width: 0, height: 0 })
	const win = useWindowDimensions()

	useLayoutEffect(() => {
		// note this doesn't run on its own after initialization (when size is 0,0), so the visible condition forces it to rerun
		const { current } = ref
		if (current && visible && (menuDims.height !== current.scrollHeight || menuDims.width !== current.scrollWidth)) {
			setMenuDims({ width: current.scrollWidth, height: current.scrollHeight })
			//console.log('Layout effect: ' + JSON.stringify({ width: current.scrollWidth, height: current.scrollHeight }))
		}
	}, [ref, visible, setMenuDims, menuDims.height, menuDims.width])

	// these should be recalculated every time, since we expect position to change on every click
	const offsetY = position.y + menuDims.height >= win.height ? 'translateY(-100%)' : ''
	const offsetX = position.x + menuDims.width >= win.width ? 'translateX(-100%)' : ''
	const offsets = offsetY || offsetX ? `${offsetX} ${offsetY}` : undefined
	//console.log(JSON.stringify(menuDims) + '; ' + JSON.stringify(win) + '; ' + visible)

	const noIcons = menuItems.every((item) => 'isSeparator' in item || item.icon === undefined)

	// We use <div> below because CDropdown prevented a interactive positioning or failed to show entirely.
	// The following was arrived at with a bit of help from Google's AI, though it too suggested many wrong ways first.
	// 1. We skip <CDropdown> to avoid Popper.js interference (even though setting popper={false} and portal={true} did not help).
	// 2. We add the 'display' style-prop to DropdownMenu to force it to render/control visibility.
	return (
		<div
			ref={ref}
			style={{
				position: 'fixed', // Use 'fixed' so it stays put regardless of scroll
				top: position.y, // offset from top of parent
				left: position.x,
				zIndex: 2000, // --cui-sidebar-zindex is 1035, the highest standard cui zindex is 1070 (https://coreui.io/v1/docs/layout/overview/)
			}}
			className="context-menu"
		>
			<CDropdownMenu style={{ display: visible ? 'block' : 'none', transform: offsets }}>
				{menuItems.map((option, idx) => (
					<MenuItem key={option.id || `item-${idx}`} data={noIcons ? { ...option, icon: 'none' } : option} />
				))}{' '}
			</CDropdownMenu>
		</div>
	)
}

// Taken from https://stackoverflow.com/questions/36862334/get-viewport-window-height-in-reactjs
interface windowSize {
	width: number
	height: number
}

function getWindowDimensions(): windowSize {
	const { innerWidth: width, innerHeight: height } = window
	return {
		width,
		height,
	}
}

function useWindowDimensions(): windowSize {
	const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions())

	useEffect(() => {
		function handleResize() {
			setWindowDimensions(getWindowDimensions())
		}

		window.addEventListener('resize', handleResize)
		return () => window.removeEventListener('resize', handleResize)
	}, [])

	return windowDimensions
}
