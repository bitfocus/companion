import {
	CAlert,
	CButton,
	CCol,
	CForm,
	CFormGroup,
	CInput,
	CInputGroup,
	CInputGroupAppend,
	CInputGroupPrepend,
	CInputGroupText,
	CLabel,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
	CRow,
} from '@coreui/react'
import React, { FormEvent, forwardRef, useCallback, useContext, useImperativeHandle, useRef, useState } from 'react'
import { KeyReceiver, socketEmitPromise, SocketContext } from '../util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileExport, faHome, faMinus, faPencil, faPlus } from '@fortawesome/free-solid-svg-icons'
import { ConfirmExportModal, ConfirmExportModalRef } from '../Components/ConfirmExportModal.js'
import { ButtonInfiniteGrid, ButtonInfiniteGridRef, PrimaryButtonGridIcon } from './ButtonInfiniteGrid.js'
import { useHasBeenRendered } from '../Hooks/useHasBeenRendered.js'
import { useResizeObserver } from 'usehooks-ts'
import { ButtonGridHeader } from './ButtonGridHeader.js'
import { ButtonGridActions, ButtonGridActionsRef } from './ButtonGridActions.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { PagesStoreModel } from '../Stores/PagesStore.js'
import { observer } from 'mobx-react-lite'
import { NumberInputField } from '../Components/NumberInputField.js'

interface ButtonsGridPanelProps {
	pageNumber: number
	onKeyDown: (event: React.KeyboardEvent) => void
	isHot: boolean
	buttonGridClick: (location: ControlLocation, pressed: boolean) => void
	changePage: (pageNumber: number) => void
	selectedButton: ControlLocation | null
	clearSelectedButton: () => void
}

export const ButtonsGridPanel = observer(function ButtonsPage({
	pageNumber,
	onKeyDown,
	isHot,
	buttonGridClick,
	changePage,
	selectedButton,
	clearSelectedButton,
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
		(direction, amount) => {
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

	const setSizeRef = useRef(null)
	const holderSize = useResizeObserver({ ref: setSizeRef })
	const useCompactButtons = (holderSize.width ?? 0) < 680 // Cutoff for what of the header row fit in the large mode

	const [gridZoom, setGridZoom] = useState(() => {
		// load the cached value, or start with default
		const storedZoom = Number(window.localStorage.getItem(`grid:zoom-scale`))
		return storedZoom && !isNaN(storedZoom) ? storedZoom : 100
	})
	const setAndStoreGridZoom = useCallback(
		(value: number) => {
			setGridZoom(value)

			// Cache the value for future page loads
			window.localStorage.setItem(`grid:zoom-scale`, value + '')
		},
		[setGridZoom]
	)

	return (
		<KeyReceiver onKeyDown={onKeyDown} tabIndex={0} className="button-grid-panel">
			<div className="button-grid-panel-header" ref={isInViewRef}>
				<ConfirmExportModal ref={exportModalRef} title="Export Page" />
				<EditPagePropertiesModal ref={editRef} />

				<h4>Buttons</h4>
				<p>
					The squares below represent each button on your Streamdeck. Click on them to set up how you want them to look,
					and what they should do when you press or click on them.
				</p>

				<CRow innerRef={setSizeRef}>
					<CCol sm={12}>
						<ButtonGridHeader pageNumber={pageNumber} changePage={changePage2} setPage={setPage}>
							<CButton color="light" onClick={showExportModal} title="Export page" className="btn-right">
								<FontAwesomeIcon icon={faFileExport} />
								&nbsp;
								{useCompactButtons ? '' : 'Export page'}
							</CButton>
							<CButton color="light" onClick={resetPosition} title="Home Position" className="btn-right">
								<FontAwesomeIcon icon={faHome} /> {useCompactButtons ? '' : 'Home Position'}
							</CButton>
							<CButton color="light" onClick={configurePage} title="Edit Page" className="btn-right">
								<FontAwesomeIcon icon={faPencil} /> {useCompactButtons ? '' : 'Edit Page'}
							</CButton>
						</ButtonGridHeader>
					</CCol>
				</CRow>
				<ButtonGridZoomSlider value={gridZoom} setValue={setAndStoreGridZoom} />
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
						drawScale={gridZoom / 100}
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

		const onNameChange = useCallback((e) => {
			setName(e.target.value)
		}, [])

		return (
			<CModal show={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
				<CModalHeader closeButton>
					<h5>Configure Page {pageNumber}</h5>
				</CModalHeader>
				<CModalBody>
					<CForm onSubmit={doAction}>
						<CFormGroup>
							<CLabel>Name</CLabel>
							<CInput type="text" value={pageName || ''} onChange={onNameChange} />
						</CFormGroup>

						<CAlert color="info">You can use resize the grid in the Settings tab</CAlert>
					</CForm>
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Cancel
					</CButton>
					<CButton innerRef={buttonRef} color="primary" onClick={doAction}>
						Save
					</CButton>
				</CModalFooter>
			</CModal>
		)
	}
)

interface ButtonGridZoomSlider {
	value: number
	setValue: (value: number) => void
}
function ButtonGridZoomSlider({ value, setValue }: ButtonGridZoomSlider) {
	const minZoom = 50
	const maxZoom = 200
	const zoomStep = 10

	const incrementZoom = useCallback(() => setValue(Math.min(value + zoomStep, maxZoom)), [value, setValue])
	const decrementZoom = useCallback(() => setValue(Math.max(value - zoomStep, minZoom)), [value, setValue])

	return (
		<CRow>
			<CCol sm={{ size: 5, offset: 3 }}>
				<CInputGroup className={'fieldtype-range'}>
					<CInputGroupPrepend>
						<CButton onClick={decrementZoom}>
							<FontAwesomeIcon icon={faMinus} />
						</CButton>
					</CInputGroupPrepend>
					<CInput
						name="zoom"
						type="range"
						min={minZoom}
						max={maxZoom}
						step={zoomStep}
						title="Zoom"
						value={value}
						onChange={(e) => setValue(parseInt(e.currentTarget.value))}
					/>
					<CInputGroupAppend>
						<CButton onClick={incrementZoom}>
							<FontAwesomeIcon icon={faPlus} />
						</CButton>
					</CInputGroupAppend>
				</CInputGroup>
			</CCol>
			<CCol sm={4}>
				<CInputGroup>
					{/* <CInputGroupPrepend>
					<CButton
						color="info"
						variant="outline"
						onClick={resetZoom}
						title={'Reset'}
					>
						<FontAwesomeIcon icon={faMagnifyingGlass} />
					</CButton>
				</CInputGroupPrepend> */}
					<NumberInputField value={value} setValue={setValue} min={minZoom} max={maxZoom} />
					<CInputGroupAppend>
						<CInputGroupText>%</CInputGroupText>
					</CInputGroupAppend>
				</CInputGroup>
			</CCol>
		</CRow>
	)
}
