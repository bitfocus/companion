import { CAlert, CButton, CCol, CInput, CInputGroup, CInputGroupAppend, CInputGroupPrepend, CRow } from '@coreui/react'
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
	faCopy,
	faEraser,
	faFileExport,
	faHome,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import classnames from 'classnames'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import Select from 'react-select'
import { ConfirmExportModal } from '../Components/ConfirmExportModal'
import { ButtonInfiniteGrid, PrimaryButtonGridIcon } from './ButtonInfiniteGrid'
import { useHasBeenRendered } from '../Hooks/useHasBeenRendered'

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

	const [newPageName, setNewPageName] = useState(null)
	const clearNewPageName = useCallback(() => setNewPageName(null), [])
	const changeNewPageName = useCallback(
		(e) => {
			socketEmitPromise(socket, 'pages:set-name', [pageNumber, e.currentTarget.value]).catch((e) => {
				console.error('Failed to set name', e)
			})
			setNewPageName(e.currentTarget.value)
		},
		[socket, pageNumber]
	)

	const pageName = pageInfo?.name ?? 'PAGE'

	const gridRef = useRef(null)

	const exportModalRef = useRef(null)
	const showExportModal = useCallback(() => {
		exportModalRef.current.show(`/int/export/page/${pageNumber}`)
	}, [pageNumber])

	const resetPosition = useCallback(() => {
		gridRef.current?.resetPosition()
	}, [gridRef])

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
			console.log('grow', direction, amount)
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

	return (
		<KeyReceiver onKeyDown={onKeyDown} tabIndex={0} className="button-grid-panel">
			<div className="button-grid-panel-header" ref={isInViewRef}>
				<ConfirmExportModal ref={exportModalRef} title="Export Page" />

				<h4>Buttons</h4>
				<p>
					The squares below represent each button on your Streamdeck. Click on them to set up how you want them to look,
					and what they should do when you press or click on them.
				</p>

				<CRow>
					<CCol sm={12}>
						<CButton
							color="light"
							style={{
								float: 'right',
								marginTop: 10,
							}}
							onClick={showExportModal}
						>
							<FontAwesomeIcon icon={faFileExport} /> Export page
						</CButton>
						&nbsp;
						<CButton
							color="light"
							style={{
								float: 'right',
								marginTop: 10,
							}}
							onClick={resetPosition}
						>
							<FontAwesomeIcon icon={faHome} /> Home Position
						</CButton>
						<ButtonGridHeader
							pageNumber={pageNumber}
							pageName={newPageName ?? pageName}
							changePage={changePage2}
							setPage={setPage}
							onNameBlur={clearNewPageName}
							onNameChange={changeNewPageName}
						/>
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
					You can navigate between pages using the arrow buttons, or by clicking the page number, typing in a number,
					and pressing 'Enter' on your keyboard.
				</CAlert>

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

	const getButton = (label, icon, func) => {
		let color = 'light'
		let disabled = false
		if (activeFunction === func) {
			color = 'success'
		} else if (activeFunction) {
			disabled = true
		}

		return (
			<CButton color={color} disabled={disabled} onClick={() => startFunction(func)}>
				<FontAwesomeIcon icon={icon} /> {label}
			</CButton>
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
				<div className="button-grid-controls">
					<div>
						{getButton('Copy', faCopy, 'copy')}
						&nbsp;
						{getButton('Move', faArrowsAlt, 'move')}
						&nbsp;
						{getButton('Delete', faTrash, 'delete')}
						&nbsp;
					</div>
					<div style={{ display: activeFunction ? '' : 'none' }}>
						<CButton color="danger" onClick={() => stopFunction()}>
							Cancel
						</CButton>
						&nbsp;
						<CButton color="disabled">{hintText}</CButton>
					</div>
					<div style={{ display: activeFunction ? 'none' : undefined }}>
						<CButton color="light" onClick={() => resetPage()}>
							<FontAwesomeIcon icon={faEraser} /> Wipe page
						</CButton>
						&nbsp;
						<CButton color="light" onClick={() => resetPageNav()}>
							<FontAwesomeIcon icon={faEraser} /> Reset page buttons
						</CButton>
					</div>
				</div>
			</CCol>
		</>
	)
})

export const ButtonGridHeader = memo(function ButtonGridHeader({
	pageNumber,
	pageName,
	onNameChange,
	onNameBlur,
	changePage,
	setPage,
}) {
	const pagesContext = useContext(PagesContext)

	const inputChange = useCallback(
		(val) => {
			const val2 = Number(val?.value)
			if (!isNaN(val2)) {
				setPage(val2)
			}
		},
		[setPage]
	)

	const nextPage = useCallback(() => {
		changePage(1)
	}, [changePage])
	const prevPage = useCallback(() => {
		changePage(-1)
	}, [changePage])

	const pageOptions = useMemo(() => {
		return Object.entries(pagesContext).map(([id, value]) => ({
			value: id,
			label: `${id} (${value.name})`,
		}))
	}, [pagesContext])

	return (
		<div className="button-grid-header">
			<CInputGroup>
				<CInputGroupPrepend>
					<CButton color="dark" hidden={!changePage} onClick={prevPage}>
						<FontAwesomeIcon icon={faChevronLeft} />
					</CButton>
				</CInputGroupPrepend>
				<Select
					className="button-page-input"
					isDisabled={!setPage}
					placeholder={pageNumber}
					classNamePrefix={'select-control'}
					isClearable={false}
					isSearchable={true}
					isMulti={false}
					options={pageOptions}
					value={{ value: pageNumber, label: pageNumber }}
					onChange={inputChange}
				/>
				<CInputGroupAppend>
					<CButton color="dark" hidden={!changePage} onClick={nextPage}>
						<FontAwesomeIcon icon={faChevronRight} />
					</CButton>
				</CInputGroupAppend>
			</CInputGroup>
			<CInput
				type="text"
				className="button-page-name"
				placeholder="Page name"
				value={pageName}
				onBlur={onNameBlur}
				onChange={onNameChange}
				disabled={!onNameChange}
			/>
		</div>
	)
})
