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
	useMemo,
} from 'react'
import { KeyReceiver, PagesContext, socketEmitPromise, SocketContext, UserConfigContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faArrowsAlt,
	faChevronLeft,
	faChevronRight,
	faCompass,
	faCopy,
	faEraser,
	faFileExport,
	faHome,
	faPencil,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import classnames from 'classnames'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import Select from 'react-select'
import { ConfirmExportModal } from '../Components/ConfirmExportModal'
import { ButtonInfiniteGrid, PrimaryButtonGridIcon } from './ButtonInfiniteGrid'
import { useHasBeenRendered } from '../Hooks/useHasBeenRendered'
import { useElementSize } from 'usehooks-ts'
import { ButtonGridHeader } from './ButtonGridHeader'

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
				changePage(newPage)
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

			if (newPage !== undefined) {
				changePage(newPage)
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
		editRef.current?.show(Number(pageNumber), pageInfo, (pageNumber, newName) => {
			socketEmitPromise(socket, 'pages:set-name', [pageNumber, newName]).catch((e) => {
				console.error('Failed to set name', e)
			})
		})
	}, [pageNumber, pageInfo])

	const gridSize = useMemo(
		() => ({
			minColumn: userConfig.grid_min_column,
			maxColumn: userConfig.grid_max_column,
			minRow: userConfig.grid_min_row,
			maxRow: userConfig.grid_max_row,
		}),
		[userConfig.grid_min_column, userConfig.grid_max_column, userConfig.grid_min_row, userConfig.grid_max_row]
	)

	const doGrow = useCallback(
		(direction, amount) => {
			switch (direction) {
				case 'left':
					socket.emit('set_userconfig_key', 'grid_min_column', gridSize.minColumn - (amount || 2))
					break
				case 'right':
					socket.emit('set_userconfig_key', 'grid_max_column', gridSize.maxColumn + (amount || 2))
					break
				case 'top':
					socket.emit('set_userconfig_key', 'grid_min_row', gridSize.minRow - (amount || 2))
					break
				case 'bottom':
					socket.emit('set_userconfig_key', 'grid_max_row', gridSize.maxRow + (amount || 2))
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
						<CButton color="light" onClick={showExportModal} title="Export page" className="btn-right">
							<FontAwesomeIcon icon={faFileExport} />
							{useCompactButtons ? '' : 'Export page'}
						</CButton>
						<CButton color="light" onClick={resetPosition} title="Home Position" className="btn-right">
							<FontAwesomeIcon icon={faHome} /> {useCompactButtons ? '' : 'Home Position'}
						</CButton>
						<CButton color="light" onClick={configurePage} title="Rename Page" className="btn-right">
							<FontAwesomeIcon icon={faPencil} /> {useCompactButtons ? '' : 'Rename Page'}
						</CButton>
						<ButtonGridHeader pageNumber={pageNumber} changePage={changePage2} setPage={setPage} />
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
						doGrow={doGrow}
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
					You can use common key commands such as copy, paste, and cut to move buttons around. You can also press the
					delete or backspace key with any button highlighted to delete it.
				</CAlert>
			</div>
		</KeyReceiver>
	)
})

const ButtonGridActions = forwardRef(function ButtonGridActions({ isHot, pageNumber, clearSelectedButton }, ref) {
	const socket = useContext(SocketContext)

	const resetRef = useRef()

	const [activeFunction, setActiveFunction] = useState(null)
	const [activeFunctionButton, setActiveFunctionButton] = useState(null)

	let hintText = ''
	if (activeFunction) {
		if (!activeFunctionButton) {
			hintText = `Press the button you want to ${activeFunction}`
		} else {
			hintText = `Where do you want it?`
		}
	}

	const startFunction = useCallback(
		(func) => {
			setActiveFunction((oldFunction) => {
				if (oldFunction === null) {
					setActiveFunctionButton(null)
					clearSelectedButton()
					return func
				} else {
					return oldFunction
				}
			})
		},
		[clearSelectedButton]
	)
	const stopFunction = useCallback(() => {
		setActiveFunction(null)
		setActiveFunctionButton(null)
	}, [])

	const [setSizeRef, holderSize] = useElementSize()
	const useCompactButtons = holderSize.width < 600 // Cutoff for what of the action buttons fit in their large mode

	const getButton = (label, icon, func) => {
		let color = 'light'
		let disabled = false
		if (activeFunction === func) {
			color = 'success'
		} else if (activeFunction) {
			disabled = true
		}

		return (
			!disabled && (
				<CButton color={color} disabled={disabled} onClick={() => startFunction(func)} title={label}>
					<FontAwesomeIcon icon={icon} /> {useCompactButtons ? '' : label}
				</CButton>
			)
		)
	}

	const resetPage = useCallback(() => {
		clearSelectedButton()

		resetRef.current.show(
			'Reset page',
			`Are you sure you want to clear all buttons on page ${pageNumber}?\nThere's no going back from this.`,
			'Reset',
			() => {
				socketEmitPromise(socket, 'loadsave:reset-page-clear', [pageNumber]).catch((e) => {
					console.error(`Clear page failed: ${e}`)
				})
			}
		)
	}, [socket, pageNumber, clearSelectedButton])
	const resetPageNav = useCallback(() => {
		clearSelectedButton()

		resetRef.current.show(
			'Reset page',
			`Are you sure you want to reset navigation buttons? This will completely erase button ${pageNumber}.1, ${pageNumber}.9 and ${pageNumber}.17`,
			'Reset',
			() => {
				socketEmitPromise(socket, 'loadsave:reset-page-nav', [pageNumber]).catch((e) => {
					console.error(`Reset nav failed: ${e}`)
				})
			}
		)
	}, [socket, pageNumber, clearSelectedButton])

	useImperativeHandle(
		ref,
		() => ({
			bankClick(location, isDown) {
				if (isDown) {
					switch (activeFunction) {
						case 'delete':
							resetRef.current.show('Clear bank', `Clear style and actions for this button?`, 'Clear', () => {
								socketEmitPromise(socket, 'controls:reset', [location]).catch((e) => {
									console.error(`Reset failed: ${e}`)
								})
							})

							stopFunction()
							return true
						case 'copy':
							if (activeFunctionButton) {
								const fromInfo = activeFunctionButton
								socketEmitPromise(socket, 'controls:copy', [fromInfo, location]).catch((e) => {
									console.error(`copy failed: ${e}`)
								})
								stopFunction()
							} else {
								setActiveFunctionButton(location)
							}
							return true
						case 'move':
							if (activeFunctionButton) {
								const fromInfo = activeFunctionButton
								socketEmitPromise(socket, 'controls:move', [fromInfo, location]).catch((e) => {
									console.error(`move failed: ${e}`)
								})
								stopFunction()
							} else {
								setActiveFunctionButton(location)
							}
							return true
						default:
							// show bank edit page
							return false
					}
				} else {
					if (activeFunction) {
						return true
					} else {
						return false
					}
				}
			},
		}),
		[socket, activeFunction, activeFunctionButton, pageNumber, stopFunction]
	)

	return (
		<>
			<GenericConfirmModal ref={resetRef} />

			<CCol sm={12} className={classnames({ out: isHot, fadeinout: true })}>
				<div className="button-grid-controls" ref={setSizeRef}>
					<div>
						{getButton('Copy', faCopy, 'copy')}
						&nbsp;
						{getButton('Move', faArrowsAlt, 'move')}
						&nbsp;
						{getButton('Delete', faTrash, 'delete')}
						&nbsp;
					</div>
					<div style={{ display: activeFunction ? '' : 'none' }}>
						<CButton color="danger" onClick={() => stopFunction()} title="Cancel">
							Cancel
						</CButton>
						&nbsp;
						<CButton color="disabled">{hintText}</CButton>
					</div>
					<div style={{ display: activeFunction ? 'none' : undefined }} title="Reset page buttons">
						<CButton color="light" onClick={() => resetPageNav()}>
							<FontAwesomeIcon icon={faCompass} /> {useCompactButtons ? '' : 'Reset page buttons'}
						</CButton>
						&nbsp;
						<CButton color="light" onClick={() => resetPage()} title="Wipe page">
							<FontAwesomeIcon icon={faEraser} /> {useCompactButtons ? '' : 'Wipe page'}
						</CButton>
					</div>
				</div>
			</CCol>
		</>
	)
})

const EditPagePropertiesModal = forwardRef(function EditPagePropertiesModal(props, ref) {
	const [data, setData] = useState(null)
	const [show, setShow] = useState(false)

	const [pageName, setName] = useState(null)

	const buttonRef = useRef()

	const buttonFocus = () => {
		if (buttonRef.current) {
			buttonRef.current.focus()
		}
	}

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => setData(null), [])
	const doAction = useCallback(
		(e) => {
			if (e) e.preventDefault()

			setData(null)
			setShow(false)
			setName(null)

			// completion callback
			const cb = data?.[1]
			cb(data?.[0], pageName)
		},
		[data, pageName]
	)

	useImperativeHandle(
		ref,
		() => ({
			show(pageNumber, pageInfo, completeCallback) {
				setName(pageInfo?.name)
				setData([pageNumber, completeCallback])
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
				<h5>Configure Page {data?.[0]}</h5>
			</CModalHeader>
			<CModalBody>
				<CForm onSubmit={doAction}>
					<CFormGroup>
						<CLabel>Name</CLabel>
						<CInput type="text" value={pageName || ''} onChange={onNameChange} />
					</CFormGroup>
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
