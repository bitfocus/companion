import { faHome } from '@fortawesome/free-solid-svg-icons'
import './ButtonGridPanel.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button.js'
import { Grid } from '~/Components/Grid'
import { useHasBeenRendered } from '~/Hooks/useHasBeenRendered.js'
import { ContextHelpButton } from '~/Layout/PanelIcons.js'
import { KeyReceiver } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ButtonGridHeader } from './ButtonGridHeader.js'
import { ButtonGridPageMenu } from './ButtonGridPageMenu.js'
import { ButtonGridResizePrompt } from './ButtonGridResizePrompt.js'
import { ButtonGridToolbar } from './ButtonGridToolbar.js'
import { useButtonGridView, useGridFocus, useGridPressMode } from './ButtonGridViewContext.js'
import { ButtonGridZoomControl } from './ButtonGridZoomControl.js'
import { ButtonInfiniteGrid, PrimaryButtonGridIcon, type ButtonInfiniteGridRef } from './ButtonInfiniteGrid.js'
import { GridButtonDragOverlay } from './GridButtonDragOverlay.js'
import type { GridZoomController } from './GridZoom.js'

interface ButtonsGridPanelProps {
	pageNumber: number
	onKeyDown: (event: React.KeyboardEvent) => void
	changePage: (pageNumber: number) => void
	gridZoomValue: number
	gridZoomController: GridZoomController
	contextMenuButton: ControlLocation | null
	onButtonContextMenu: (location: ControlLocation, x: number, y: number) => void
}

export const ButtonsGridPanel = observer(function ButtonsPage({
	pageNumber,
	onKeyDown,
	changePage,
	gridZoomValue,
	gridZoomController,
	contextMenuButton,
	onButtonContextMenu,
}: ButtonsGridPanelProps) {
	const { pages, userConfig } = useContext(RootAppStoreContext)
	const { store } = useButtonGridView()

	const setPage = useCallback(
		(newPage: number) => {
			if (newPage >= 1 && newPage <= pages.data.length) {
				changePage(newPage)
			}
		},
		[changePage, pages]
	)

	const changePage2 = useCallback(
		(delta: number) => {
			const pageCount = pages.data.length

			let newPage = pageNumber + delta
			if (newPage < 1) newPage += pageCount
			if (newPage > pageCount) newPage -= pageCount

			if (!isNaN(newPage)) {
				changePage(newPage)
			}
		},
		[changePage, pageNumber, pages]
	)

	const pageInfo = pages.get(pageNumber)

	const gridRef = useRef<ButtonInfiniteGridRef>(null)

	const resetPosition = useCallback(() => {
		gridRef.current?.resetPosition()
	}, [gridRef])

	const gridSize = userConfig.properties?.gridSize

	const [hasBeenInView, isInViewRef] = useHasBeenRendered()
	const [viewportMinHeight, setViewportMinHeight] = useState(250) // arbitrary initial min-height

	// Ctrl/cmd + wheel zooms, the way every canvas does. React attaches wheel passively at the root,
	// where preventDefault is a no-op, so this has to be a native listener to stop the browser
	// zooming the whole page instead.
	const contentRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = contentRef.current
		if (!el) return

		const handleWheel = (e: WheelEvent) => {
			if (!e.ctrlKey && !e.metaKey) return // A plain wheel must still scroll the grid

			e.preventDefault()
			if (e.deltaY < 0) gridZoomController.zoomIn(true)
			else if (e.deltaY > 0) gridZoomController.zoomOut(true)
		}

		el.addEventListener('wheel', handleWheel, { passive: false })
		return () => el.removeEventListener('wheel', handleWheel)
	}, [gridZoomController])

	const pressMode = useGridPressMode()
	const focus = useGridFocus()

	const selectRectangle = useCallback(
		(from: ControlLocation, to: ControlLocation, additive: boolean) => store.selectRectangle(from, to, additive),
		[store]
	)

	// Keyboard navigation is useless if it walks the focus off the edge of what you can see
	useEffect(() => {
		if (focus && focus.pageNumber === pageNumber) gridRef.current?.revealLocation(focus)
	}, [focus, pageNumber])

	return (
		<KeyReceiver onKeyDown={onKeyDown} tabIndex={0} className="button-grid-panel">
			<div className="button-grid-panel-header" ref={isInViewRef}>
				<ButtonGridResizePrompt />

				<Grid.Row>
					<Grid.Col sm={12}>
						<ButtonGridHeader pageNumber={pageNumber} changePage={changePage2} setPage={setPage}>
							<ButtonGridZoomControl
								useCompactButtons={true}
								gridZoomValue={gridZoomValue}
								gridZoomController={gridZoomController}
							/>
							<Button color="light" onClick={resetPosition} title="Home Position" className="ms-1">
								<FontAwesomeIcon icon={faHome} />
							</Button>
							<ButtonGridPageMenu pageNumber={pageNumber} pageInfo={pageInfo} />
							<ContextHelpButton action="/user-guide/config/buttons/" />
						</ButtonGridHeader>
					</Grid.Col>
				</Grid.Row>

				<ButtonGridToolbar />
			</div>
			{/* Rendered inside the grid's own styles, so the ghost is drawn the way the grid draws buttons */}
			<GridButtonDragOverlay />

			<div className="button-grid-panel-content" style={{ minHeight: viewportMinHeight }} ref={contentRef}>
				{hasBeenInView && gridSize && (
					<ButtonInfiniteGrid
						ref={gridRef}
						isHot={pressMode}
						pageNumber={pageNumber}
						contextMenuButton={contextMenuButton}
						onButtonContextMenu={onButtonContextMenu}
						gridSize={gridSize}
						ButtonIconFactory={PrimaryButtonGridIcon}
						onMarqueeSelect={selectRectangle}
						drawScale={gridZoomValue / 100}
						setViewportMinHeight={setViewportMinHeight}
					/>
				)}
			</div>
		</KeyReceiver>
	)
})
