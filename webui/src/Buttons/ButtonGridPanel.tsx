import { CButton, CCol, CRow } from '@coreui/react'
import { faFileExport, faHome, faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext, useRef, useState } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { StaticAlert } from '~/Components/Alert.js'
import { ConfirmExportModal, type ConfirmExportModalRef } from '~/Components/ConfirmExportModal.js'
import { useHasBeenRendered } from '~/Hooks/useHasBeenRendered.js'
import { ContextHelpButton } from '~/Layout/PanelIcons.js'
import { KeyReceiver, makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ButtonGridActions, type ButtonGridActionsRef } from './ButtonGridActions.js'
import { ButtonGridHeader } from './ButtonGridHeader.js'
import { ButtonGridResizePrompt } from './ButtonGridResizePrompt.js'
import { ButtonGridZoomControl } from './ButtonGridZoomControl.js'
import { ButtonInfiniteGrid, PrimaryButtonGridIcon, type ButtonInfiniteGridRef } from './ButtonInfiniteGrid.js'
import { EditPagePropertiesModal, type EditPagePropertiesModalRef } from './EditPageProperties.js'
import type { GridZoomController } from './GridZoom.js'

interface ButtonsGridPanelProps {
	pageNumber: number
	onKeyDown: (event: React.KeyboardEvent) => void
	isHot: boolean
	buttonGridClick: (location: ControlLocation, pressed: boolean) => void
	changePage: (pageNumber: number) => void
	selectedButton: ControlLocation | null
	clearSelectedButton: () => void
	gridZoomValue: number
	gridZoomController: GridZoomController
}

export const ButtonsGridPanel = observer(function ButtonsPage({
	pageNumber,
	onKeyDown,
	isHot,
	buttonGridClick,
	changePage,
	selectedButton,
	clearSelectedButton,
	gridZoomValue,
	gridZoomController,
}: ButtonsGridPanelProps) {
	const { pages, userConfig } = useContext(RootAppStoreContext)

	const actionsRef = useRef<ButtonGridActionsRef>(null)

	const buttonClick = useCallback(
		(location: ControlLocation, isDown: boolean) => {
			if (!actionsRef.current?.buttonClick(location, isDown)) {
				buttonGridClick(location, isDown)
			}
		},
		[buttonGridClick]
	)

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
	const editRef = useRef<EditPagePropertiesModalRef>(null)

	const exportModalRef = useRef<ConfirmExportModalRef>(null)
	const showExportModal = useCallback(() => {
		exportModalRef.current?.show(makeAbsolutePath(`/int/export/page/${pageNumber}`))
	}, [pageNumber])

	const resetPosition = useCallback(() => {
		gridRef.current?.resetPosition()
	}, [gridRef])

	const configurePage = useCallback(() => {
		editRef.current?.show(Number(pageNumber), pageInfo)
	}, [pageNumber, pageInfo])

	const gridSize = userConfig.properties?.gridSize

	const [hasBeenInView, isInViewRef] = useHasBeenRendered()
	const [viewportMinHeight, setViewportMinHeight] = useState(250) // arbitrary initial min-height

	return (
		<KeyReceiver onKeyDown={onKeyDown} tabIndex={0} className="button-grid-panel">
			<div className="button-grid-panel-header" ref={isInViewRef}>
				<ConfirmExportModal ref={exportModalRef} title="Export Page" />
				<EditPagePropertiesModal ref={editRef} includeName />

				<h4 className="btn-inline">
					Buttons
					<ContextHelpButton action="/user-guide/config/buttons/" />
				</h4>
				<p style={{ marginBottom: '0.5rem' }}>
					The squares below represent each button on your Streamdeck. Click on them to set up how you want them to look,
					and what they should do when you press or click on them.
				</p>

				<ButtonGridResizePrompt />

				<CRow>
					<CCol sm={12}>
						<ButtonGridHeader pageNumber={pageNumber} changePage={changePage2} setPage={setPage}>
							<CButton color="light" onClick={showExportModal} title="Export Page" className="btn-right">
								<FontAwesomeIcon icon={faFileExport} />
							</CButton>
							<CButton color="light" onClick={configurePage} title="Edit Page" className="btn-right">
								<FontAwesomeIcon icon={faPencil} />
							</CButton>
							<CButton color="light" onClick={resetPosition} title="Home Position" className="btn-right">
								<FontAwesomeIcon icon={faHome} />
							</CButton>
							<ButtonGridZoomControl
								useCompactButtons={true}
								gridZoomValue={gridZoomValue}
								gridZoomController={gridZoomController}
							/>
						</ButtonGridHeader>
					</CCol>
				</CRow>
			</div>
			<div className="button-grid-panel-content" style={{ minHeight: viewportMinHeight }}>
				{hasBeenInView && gridSize && (
					<ButtonInfiniteGrid
						ref={gridRef}
						isHot={isHot}
						pageNumber={pageNumber}
						buttonClick={buttonClick}
						selectedButton={selectedButton}
						gridSize={gridSize}
						ButtonIconFactory={PrimaryButtonGridIcon}
						drawScale={gridZoomValue / 100}
						setViewportMinHeight={setViewportMinHeight}
					/>
				)}
			</div>
			<div className="button-grid-panel-footer">
				<ButtonGridActions
					ref={actionsRef}
					isHot={isHot}
					pageNumber={pageNumber}
					clearSelectedButton={clearSelectedButton}
				/>

				<StaticAlert color="info" className="mb-2">
					You can use the arrow keys, pageup and pagedown to navigate with the keyboard, and use common key commands
					such as copy, paste, and cut to rearrange buttons. You can also press the delete or backspace key with any
					button highlighted to delete it.
				</StaticAlert>
			</div>
		</KeyReceiver>
	)
})
