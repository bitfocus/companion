import {
	CAlert,
	CButton,
	CCol,
	CForm,
	CFormGroup,
	CInput,
	CLabel,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
	CRow,
} from '@coreui/react'
import React, {
	forwardRef,
	memo,
	useCallback,
	useContext,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from 'react'
import { KeyReceiver, PagesContext, socketEmitPromise, SocketContext, UserConfigContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileExport, faHome, faPencil } from '@fortawesome/free-solid-svg-icons'
import { ConfirmExportModal } from '../Components/ConfirmExportModal'
import { ButtonInfiniteGrid, PrimaryButtonGridIcon } from './ButtonInfiniteGrid'
import { useHasBeenRendered } from '../Hooks/useHasBeenRendered'
import { useElementSize } from 'usehooks-ts'
import { ButtonGridHeader } from './ButtonGridHeader'
import { ButtonGridActions } from './ButtonGridActions'

export const ButtonsGridPanel = memo(function ButtonsPage({
	pageNumber,
	onKeyDown,
	isHot,
	buttonGridClick,
	changePage,
	selectedButton,
	clearSelectedButton,
}) {
	const socket = useContext(SocketContext)
	const pages = useContext(PagesContext)
	const userConfig = useContext(UserConfigContext)
	const pagesRef = useRef()

	useEffect(() => {
		// Avoid binding into callbacks
		pagesRef.current = pages
	}, [pages])

	const actionsRef = useRef()

	const bankClick = useCallback(
		(location, isDown) => {
			if (!actionsRef.current?.bankClick(location, isDown)) {
				buttonGridClick(location, isDown)
			}
		},
		[buttonGridClick]
	)

	const setPage = useCallback(
		(newPage) => {
			const pageNumbers = Object.keys(pagesRef.current || {})
			const newIndex = pageNumbers.findIndex((p) => p === newPage + '')
			if (newIndex !== -1) {
				changePage(Number(newPage))
			}
		},
		[changePage]
	)

	const changePage2 = useCallback(
		(delta) => {
			const pageNumbers = Object.keys(pagesRef.current || {})
			const currentIndex = pageNumbers.findIndex((p) => p === pageNumber + '')
			let newPage = pageNumbers[0]
			if (currentIndex !== -1) {
				let newIndex = currentIndex + delta
				if (newIndex < 0) newIndex += pageNumbers.length
				if (newIndex >= pageNumbers.length) newIndex -= pageNumbers.length

				newPage = pageNumbers[newIndex]
			}

			if (newPage !== undefined && !isNaN(newPage)) {
				changePage(Number(newPage))
			}
		},
		[changePage, pageNumber]
	)

	const pageInfo = pages?.[pageNumber]

	const gridRef = useRef(null)
	const editRef = useRef(null)

	const exportModalRef = useRef(null)
	const showExportModal = useCallback(() => {
		exportModalRef.current.show(`/int/export/page/${pageNumber}`)
	}, [pageNumber])

	const resetPosition = useCallback(() => {
		gridRef.current?.resetPosition()
	}, [gridRef])

	const configurePage = useCallback(() => {
		editRef.current?.show(Number(pageNumber), pageInfo)
	}, [pageNumber, pageInfo])

	const gridSize = userConfig.gridSize

	const doGrow = useCallback(
		(direction, amount) => {
			if (amount <= 0) return

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

	const [setSizeRef, holderSize] = useElementSize()
	const useCompactButtons = holderSize.width < 680 // Cutoff for what of the header row fit in the large mode

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
			</div>
			<div className="button-grid-panel-content">
				{hasBeenInView && (
					<ButtonInfiniteGrid
						ref={gridRef}
						isHot={isHot}
						pageNumber={pageNumber}
						bankClick={bankClick}
						selectedButton={selectedButton}
						gridSize={gridSize}
						doGrow={userConfig.gridSizeInlineGrow ? doGrow : undefined}
						buttonIconFactory={PrimaryButtonGridIcon}
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

const EditPagePropertiesModal = forwardRef(function EditPagePropertiesModal(props, ref) {
	const socket = useContext(SocketContext)
	const [pageNumber, setPageNumber] = useState(null)
	const [show, setShow] = useState(false)

	const [pageName, setName] = useState(null)

	const buttonRef = useRef()

	const buttonFocus = () => {
		if (buttonRef.current) {
			buttonRef.current.focus()
		}
	}

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => setPageNumber(null), [])
	const doAction = useCallback(
		(e) => {
			if (e) e.preventDefault()

			setPageNumber(null)
			setShow(false)
			setName(null)

			if (pageNumber === null) return

			socketEmitPromise(socket, 'pages:set-name', [pageNumber, pageName]).catch((e) => {
				console.error('Failed to set name', e)
			})
		},
		[pageNumber, pageName]
	)

	useImperativeHandle(
		ref,
		() => ({
			show(pageNumber, pageInfo) {
				setName(pageInfo?.name)
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
})
