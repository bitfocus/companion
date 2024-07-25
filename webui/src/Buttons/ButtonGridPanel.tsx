import {
	CAlert,
	CButton,
	CCol,
	CForm,
	CFormInput,
	CFormLabel,
	CModalBody,
	CModalFooter,
	CModalHeader,
	CRow,
} from '@coreui/react'
import React, { FormEvent, forwardRef, useCallback, useContext, useImperativeHandle, useRef, useState } from 'react'
import { KeyReceiver, socketEmitPromise, SocketContext } from '../util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileExport, faHome, faPencil } from '@fortawesome/free-solid-svg-icons'
import { ConfirmExportModal, ConfirmExportModalRef } from '../Components/ConfirmExportModal.js'
import { ButtonInfiniteGrid, ButtonInfiniteGridRef, PrimaryButtonGridIcon } from './ButtonInfiniteGrid.js'
import { useHasBeenRendered } from '../Hooks/useHasBeenRendered.js'
import { ButtonGridHeader } from './ButtonGridHeader.js'
import { ButtonGridActions, ButtonGridActionsRef } from './ButtonGridActions.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { PagesStoreModel } from '../Stores/PagesStore.js'
import { observer } from 'mobx-react-lite'
import { ButtonGridZoomControl } from './ButtonGridZoomControl.js'
import { GridZoomController } from './GridZoom.js'
import { CModalExt } from '../Components/CModalExt.js'

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
	const { socket, pages, userConfig } = useContext(RootAppStoreContext)

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
			const pageNumbers = pages.pageNumbers
			const newIndex = pageNumbers.findIndex((p) => p === newPage)
			if (newIndex !== -1) {
				changePage(Number(newPage))
			}
		},
		[changePage, pages]
	)

	const changePage2 = useCallback(
		(delta: number) => {
			const pageNumbers = pages.pageNumbers
			const currentIndex = pageNumbers.findIndex((p) => p === pageNumber)
			let newPage = pageNumbers[0]
			if (currentIndex !== -1) {
				let newIndex = currentIndex + delta
				if (newIndex < 0) newIndex += pageNumbers.length
				if (newIndex >= pageNumbers.length) newIndex -= pageNumbers.length

				newPage = pageNumbers[newIndex]
			}

			if (newPage !== undefined && !isNaN(Number(newPage))) {
				changePage(Number(newPage))
			}
		},
		[changePage, pageNumber, pages]
	)

	const pageInfo = pages.store.get(pageNumber)

	const gridRef = useRef<ButtonInfiniteGridRef>(null)
	const editRef = useRef<EditPagePropertiesModalRef>(null)

	const exportModalRef = useRef<ConfirmExportModalRef>(null)
	const showExportModal = useCallback(() => {
		exportModalRef.current?.show(`/int/export/page/${pageNumber}`)
	}, [pageNumber])

	const resetPosition = useCallback(() => {
		gridRef.current?.resetPosition()
	}, [gridRef])

	const configurePage = useCallback(() => {
		editRef.current?.show(Number(pageNumber), pageInfo)
	}, [pageNumber, pageInfo])

	const gridSize = userConfig.properties?.gridSize

	const doGrow = useCallback(
		(direction: 'left' | 'right' | 'top' | 'bottom', amount: number) => {
			if (amount <= 0 || !gridSize) return

			switch (direction) {
				case 'left':
					socket.emit('set_userconfig_key', 'gridSize', {
						...gridSize,
						minColumn: gridSize.minColumn - (amount || 2),
					})
					break
				case 'right':
					socket.emit('set_userconfig_key', 'gridSize', {
						...gridSize,
						maxColumn: gridSize.maxColumn + (amount || 2),
					})
					break
				case 'top':
					socket.emit('set_userconfig_key', 'gridSize', {
						...gridSize,
						minRow: gridSize.minRow - (amount || 2),
					})
					break
				case 'bottom':
					socket.emit('set_userconfig_key', 'gridSize', {
						...gridSize,
						maxRow: gridSize.maxRow + (amount || 2),
					})
					break
			}
		},
		[socket, gridSize]
	)

	const [hasBeenInView, isInViewRef] = useHasBeenRendered()

	return (
		<KeyReceiver onKeyDown={onKeyDown} tabIndex={0} className="button-grid-panel">
			<div className="button-grid-panel-header" ref={isInViewRef}>
				<ConfirmExportModal ref={exportModalRef} title="Export Page" />
				<EditPagePropertiesModal ref={editRef} />

				<h4>Buttons</h4>
				<p style={{ marginBottom: '0.5rem' }}>
					The squares below represent each button on your Streamdeck. Click on them to set up how you want them to look,
					and what they should do when you press or click on them.
				</p>

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
			<div className="button-grid-panel-content">
				{hasBeenInView && gridSize && (
					<ButtonInfiniteGrid
						ref={gridRef}
						isHot={isHot}
						pageNumber={pageNumber}
						buttonClick={buttonClick}
						selectedButton={selectedButton}
						gridSize={gridSize}
						doGrow={userConfig.properties?.gridSizeInlineGrow ? doGrow : undefined}
						buttonIconFactory={PrimaryButtonGridIcon}
						drawScale={gridZoomValue / 100}
					/>
				)}
			</div>
			<div className="button-grid-panel-footer">
				<CRow style={{ paddingTop: '15px' }}>
					<ButtonGridActions
						ref={actionsRef}
						isHot={isHot}
						pageNumber={pageNumber}
						clearSelectedButton={clearSelectedButton}
					/>
				</CRow>

				<CAlert color="info">
					You can use the arrow keys, pageup and pagedown to navigate with the keyboard, and use common key commands
					such as copy, paste, and cut to rearrange buttons. You can also press the delete or backspace key with any
					button highlighted to delete it.
				</CAlert>
			</div>
		</KeyReceiver>
	)
})

interface EditPagePropertiesModalRef {
	show(pageNumber: number, pageInfo: PagesStoreModel | undefined): void
}
interface EditPagePropertiesModalProps {
	// Nothing
}

const EditPagePropertiesModal = forwardRef<EditPagePropertiesModalRef, EditPagePropertiesModalProps>(
	function EditPagePropertiesModal(_props, ref) {
		const socket = useContext(SocketContext)
		const [pageNumber, setPageNumber] = useState<number | null>(null)
		const [show, setShow] = useState(false)

		const [pageName, setName] = useState<string | null>(null)

		const buttonRef = useRef<HTMLButtonElement>(null)

		const buttonFocus = () => {
			if (buttonRef.current) {
				buttonRef.current.focus()
			}
		}

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => setPageNumber(null), [])
		const doAction = useCallback(
			(e: FormEvent) => {
				if (e) e.preventDefault()

				setPageNumber(null)
				setShow(false)
				setName(null)

				if (pageNumber === null) return

				socketEmitPromise(socket, 'pages:set-name', [pageNumber, pageName ?? '']).catch((e) => {
					console.error('Failed to set name', e)
				})
			},
			[pageNumber, pageName]
		)

		useImperativeHandle(
			ref,
			() => ({
				show(pageNumber, pageInfo) {
					setName(pageInfo?.name ?? null)
					setPageNumber(pageNumber)
					setShow(true)

					// Focus the button asap. It also gets focused once the open is complete
					setTimeout(buttonFocus, 50)
				},
			}),
			[]
		)

		const onNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
			setName(e.target.value)
		}, [])

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
				<CModalHeader closeButton>
					<h5>Configure Page {pageNumber}</h5>
				</CModalHeader>
				<CModalBody>
					<CForm onSubmit={doAction}>
						<CRow className="mb-3">
							<CFormLabel htmlFor="colFormName" className="col-sm-3 col-form-label col-form-label-sm">
								Name
							</CFormLabel>
							<CCol sm={9}>
								<CFormInput name="colFormName" type="text" value={pageName || ''} onChange={onNameChange} />
							</CCol>
							<CCol sm={12}>
								<br />
								<CAlert color="info">You can use resize the grid in the Settings tab</CAlert>
							</CCol>
						</CRow>
					</CForm>
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Cancel
					</CButton>
					<CButton ref={buttonRef} color="primary" onClick={doAction}>
						Save
					</CButton>
				</CModalFooter>
			</CModalExt>
		)
	}
)
