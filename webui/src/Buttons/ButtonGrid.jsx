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
import { KeyReceiver, PagesContext, socketEmitPromise, SocketContext, ButtonRenderCacheContext } from '../util'
import { CreateBankControlId } from '@companion/shared/ControlId'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faArrowsAlt,
	faChevronLeft,
	faChevronRight,
	faCopy,
	faEraser,
	faFileExport,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import classnames from 'classnames'
import { MAX_COLS, MAX_ROWS } from '../Constants'
import { useDrop } from 'react-dnd'
import { ButtonPreview } from '../Components/ButtonPreview'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { nanoid } from 'nanoid'
import { useSharedPageRenderCache } from '../ButtonRenderCache'

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
	const pagesRef = useRef()

	useEffect(() => {
		// Avoid binding into callbacks
		pagesRef.current = pages
	}, [pages])

	const actionsRef = useRef()

	const bankClick = useCallback(
		(index, isDown) => {
			console.log('bank', pageNumber, index, isDown)
			if (!actionsRef.current?.bankClick(index, isDown)) {
				buttonGridClick(pageNumber, index, isDown)
			}
		},
		[buttonGridClick, pageNumber]
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

	return (
		<KeyReceiver onKeyDown={onKeyDown} tabIndex={0}>
			<h4>Buttons</h4>
			<p>
				The squares below represent each button on your Streamdeck. Click on them to set up how you want them to look,
				and what they should do when you press or click on them.
			</p>
			<div style={{ paddingRight: 16 }}>
				<CRow>
					<CCol sm={12}>
						<CButton
							color="light"
							style={{
								float: 'right',
								marginTop: 10,
							}}
							href={`/int/page_export/${pageNumber}`}
							target="_new"
						>
							<FontAwesomeIcon icon={faFileExport} /> Export page
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

				<CRow className={classnames({ 'bank-armed': isHot, bankgrid: true })}>
					<ButtonGrid pageNumber={pageNumber} bankClick={bankClick} selectedButton={selectedButton} />
				</CRow>

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
			bankClick(index, isDown) {
				if (isDown) {
					switch (activeFunction) {
						case 'delete':
							resetRef.current.show('Clear bank', `Clear style and actions for this button?`, 'Clear', () => {
								const controlId = CreateBankControlId(pageNumber, index)
								socketEmitPromise(socket, 'controls:reset', [controlId]).catch((e) => {
									console.error(`Reset failed: ${e}`)
								})
							})

							stopFunction()
							return true
						case 'copy':
							if (activeFunctionButton) {
								const fromInfo = activeFunctionButton
								socketEmitPromise(socket, 'controls:copy', [
									CreateBankControlId(fromInfo.page, fromInfo.bank),
									CreateBankControlId(pageNumber, index),
								]).catch((e) => {
									console.error(`copy failed: ${e}`)
								})
								stopFunction()
							} else {
								setActiveFunctionButton({
									page: pageNumber,
									bank: index,
								})
							}
							return true
						case 'move':
							if (activeFunctionButton) {
								const fromInfo = activeFunctionButton
								socketEmitPromise(socket, 'controls:move', [
									CreateBankControlId(fromInfo.page, fromInfo.bank),
									CreateBankControlId(pageNumber, index),
								]).catch((e) => {
									console.error(`move failed: ${e}`)
								})
								stopFunction()
							} else {
								setActiveFunctionButton({
									page: pageNumber,
									bank: index,
								})
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
	const [tmpText, setTmpText] = useState(null)

	const inputChange = useCallback(
		(e) => {
			const number = parseInt(e.currentTarget.value)
			if (number > 0) {
				setTmpText(number)
			} else if (e.currentTarget.value === '') {
				setTmpText(e.currentTarget.value)
			}
		},
		[setTmpText]
	)
	const inputBlur = useCallback(() => {
		setTmpText((tmpText) => {
			if (typeof tmpText === 'number') {
				setPage(tmpText)
			}

			return null
		})
	}, [setTmpText, setPage])

	const inputEnter = useCallback(
		(e) => {
			if (e.key === 'Enter') {
				inputBlur()
			}
		},
		[inputBlur]
	)

	const inputSelectAll = (event) => {
		setTimeout(event.target.select.bind(event.target), 20)
	}

	const nextPage = useCallback(() => {
		changePage(1)
	}, [changePage])
	const prevPage = useCallback(() => {
		changePage(-1)
	}, [changePage])

	return (
		<div className="button-grid-header">
			<CInputGroup>
				<CInputGroupPrepend>
					<CButton color="dark" hidden={!changePage} onClick={prevPage}>
						<FontAwesomeIcon icon={faChevronLeft} />
					</CButton>
				</CInputGroupPrepend>
				<CInput
					type="text"
					disabled={!setPage}
					placeholder={pageNumber}
					value={tmpText ?? pageNumber}
					onChange={inputChange}
					onBlur={inputBlur}
					onFocus={inputSelectAll}
					onKeyDown={inputEnter}
					className="button-page-input"
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

export function ButtonGrid({ bankClick, pageNumber, selectedButton }) {
	const buttonCache = useContext(ButtonRenderCacheContext)

	const gridId = useMemo(() => nanoid(), [])
	const pageImages = useSharedPageRenderCache(buttonCache, gridId, pageNumber)

	return (
		<div
			style={{
				paddingTop: 14,
				paddingBottom: 14,
				backgroundColor: '#222',
				borderRadius: 20,
				marginLeft: 14,
			}}
		>
			{Array(MAX_ROWS)
				.fill(0)
				.map((_, y) => {
					return (
						<CCol key={y} sm={12} className="pagebank-row">
							{Array(MAX_COLS)
								.fill(0)
								.map((_, x) => {
									const index = y * MAX_COLS + x + 1
									const controlId = CreateBankControlId(pageNumber, index)
									return (
										<ButtonGridIcon
											key={x}
											page={pageNumber}
											index={index}
											preview={pageImages[index]}
											onClick={bankClick}
											alt={`Button ${index}`}
											selected={selectedButton === controlId}
										/>
									)
								})}
						</CCol>
					)
				})}
		</div>
	)
}

const ButtonGridIcon = memo(function ButtonGridIcon(props) {
	const socket = useContext(SocketContext)

	const [{ isOver, canDrop }, drop] = useDrop({
		accept: 'preset',
		drop: (dropData) => {
			console.log('preset drop', dropData)
			socketEmitPromise(socket, 'presets:import_to_bank', [
				dropData.instanceId,
				dropData.presetId,
				props.page,
				props.index,
			]).catch((e) => {
				console.error('Preset import failed')
			})
		},
		collect: (monitor) => ({
			isOver: !!monitor.isOver(),
			canDrop: !!monitor.canDrop(),
		}),
	})

	const title = `${props.page}.${props.index}`
	return <ButtonPreview {...props} dropRef={drop} dropHover={isOver} canDrop={canDrop} alt={title} title={title} />
})
