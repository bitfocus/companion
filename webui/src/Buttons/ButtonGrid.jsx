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
} from 'react'
import { CompanionContext, KeyReceiver, LoadingRetryOrError, socketEmit } from '../util'
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
import { MAX_COLS, MAX_ROWS, MAX_BUTTONS } from '../Constants'
import { useDrop } from 'react-dnd'
import { BankPreview, dataToButtonImage } from '../Components/BankButton'
import shortid from 'shortid'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'

export const ButtonsGridPanel = memo(function ButtonsPage({
	pageNumber,
	onKeyDown,
	isHot,
	buttonGridClick,
	changePage,
	selectedButton,
	clearSelectedButton,
}) {
	const context = useContext(CompanionContext)

	const actionsRef = useRef()

	const [pages, setPages] = useState(null)
	const [loadError, setLoadError] = useState(null)

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
			const pageNumbers = Object.keys(pages)
			const newIndex = pageNumbers.findIndex((p) => p === newPage + '')
			if (newIndex !== -1) {
				changePage(newPage)
			}
		},
		[changePage, pages]
	)

	const changePage2 = useCallback(
		(delta) => {
			const pageNumbers = Object.keys(pages)
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
		[changePage, pages, pageNumber]
	)

	const pageInfo = pages?.[pageNumber]

	const [newPageName, setNewPageName] = useState(null)
	const clearNewPageName = useCallback(() => setNewPageName(null), [])
	const changeNewPageName = useCallback(
		(e) => {
			context.socket.emit('set_page', pageNumber, {
				...pageInfo,
				name: e.currentTarget.value,
			})
			setNewPageName(e.currentTarget.value)
		},
		[context.socket, pageNumber, pageInfo]
	)

	const [retryToken, setRetryToken] = useState(shortid())
	const doRetryLoad = useCallback(() => setRetryToken(shortid()), [])
	useEffect(() => {
		setLoadError(null)
		setPages(null)

		socketEmit(context.socket, 'get_page_all', [])
			.then(([pages]) => {
				setLoadError(null)
				setPages(pages)
			})
			.catch((e) => {
				console.error('Failed to load pages list:', e)
				setLoadError(`Failed to load pages list`)
				setPages(null)
			})

		const updatePageInfo = (page, info) => {
			setPages((oldPages) => {
				if (oldPages) {
					return {
						...oldPages,
						[page]: info,
					}
				} else {
					return null
				}
			})
		}

		context.socket.on('set_page', updatePageInfo)

		return () => {
			context.socket.off('set_page', updatePageInfo)
		}
	}, [context.socket, retryToken])

	if (!pages) {
		return <LoadingRetryOrError error={loadError} dataReady={pages} doRetry={doRetryLoad} />
	}

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

				<CRow className={classnames({ 'bank-armed': isHot, bankgrid: true, 'with-markings': true })}>
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
			</div>
		</KeyReceiver>
	)
})

const ButtonGridActions = forwardRef(function ButtonGridActions({ isHot, pageNumber, clearSelectedButton }, ref) {
	const context = useContext(CompanionContext)

	const resetRef = useRef()

	const [activeFunction, setActiveFunction] = useState(null)
	const [activeFunctionBank, setActiveFunctionBank] = useState(null)

	let hintText = ''
	if (activeFunction) {
		if (!activeFunctionBank) {
			hintText = `Press the button you want to ${activeFunction}`
		} else {
			hintText = `Where do you want it?`
		}
	}

	const startFunction = useCallback(
		(func) => {
			setActiveFunction((oldFunction) => {
				if (oldFunction === null) {
					setActiveFunctionBank(null)
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
		setActiveFunctionBank(null)
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
				context.socket.emit('loadsave_reset_page_all', pageNumber)
			}
		)
	}, [context.socket, pageNumber, clearSelectedButton])
	const resetPageNav = useCallback(() => {
		clearSelectedButton()

		resetRef.current.show(
			'Reset page',
			`Are you sure you want to reset navigation buttons? This will completely erase bank ${pageNumber}.1, ${pageNumber}.9 and ${pageNumber}.17`,
			'Reset',
			() => {
				context.socket.emit('loadsave_reset_page_nav', pageNumber)
			}
		)
	}, [context.socket, pageNumber, clearSelectedButton])

	useImperativeHandle(
		ref,
		() => ({
			bankClick(index, isDown) {
				if (isDown) {
					switch (activeFunction) {
						case 'delete':
							resetRef.current.show('Clear bank', `Clear style and actions for this button?`, 'Clear', () => {
								context.socket.emit('bank_reset', pageNumber, index)
							})

							stopFunction()
							return true
						case 'copy':
							if (activeFunctionBank) {
								const fromInfo = activeFunctionBank
								context.socket.emit('bank_copy', fromInfo.page, fromInfo.bank, pageNumber, index)
								stopFunction()
							} else {
								setActiveFunctionBank({
									page: pageNumber,
									bank: index,
								})
							}
							return true
						case 'move':
							if (activeFunctionBank) {
								const fromInfo = activeFunctionBank
								context.socket.emit('bank_move', fromInfo.page, fromInfo.bank, pageNumber, index)
								stopFunction()
							} else {
								setActiveFunctionBank({
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
		[context.socket, activeFunction, activeFunctionBank, pageNumber, stopFunction]
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

export function ButtonGridHeader({ pageNumber, pageName, onNameChange, onNameBlur, changePage, setPage }) {
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

	return (
		<div className="button-grid-header">
			<CInputGroup>
				<CInputGroupPrepend>
					<CButton color="dark" hidden={!changePage} onClick={() => changePage(-1)}>
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
					<CButton color="dark" hidden={!changePage} onClick={() => changePage(1)}>
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
}

function ButtonGrid({ bankClick, pageNumber, selectedButton }) {
	const context = useContext(CompanionContext)

	const [imageCache, setImageCache] = useState({})

	useEffect(() => {
		const updatePreviewImages = (images) => {
			setImageCache((oldImages) => {
				const newImages = { ...oldImages }
				for (let key = 1; key <= MAX_BUTTONS; ++key) {
					if (images[key] !== undefined) {
						newImages[key] = {
							image: dataToButtonImage(images[key].buffer),
							updated: images[key].updated,
						}
					}
				}
				return newImages
			})
		}

		context.socket.on('preview_page_data', updatePreviewImages)

		// Inform server of our new page, and last updated, so it can skip unchanged previews
		setImageCache((imageCache) => {
			// don't want to change imageCache, but this avoids the dependency
			const lastUpdated = {}
			for (const [id, data] of Object.entries(imageCache)) {
				lastUpdated[id] = { updated: data.updated }
			}
			context.socket.emit('bank_preview_page', pageNumber, lastUpdated)
			return imageCache
		})

		return () => {
			context.socket.off('preview_page_data', updatePreviewImages)
		}
	}, [context.socket, pageNumber])

	const selectedPage = selectedButton ? selectedButton[0] : null
	const selectedBank = selectedButton ? selectedButton[1] : null

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
									return (
										<ButtonGridIcon
											key={x}
											page={pageNumber}
											index={index}
											preview={imageCache[index]?.image}
											onClick={bankClick}
											alt={`Bank ${index}`}
											selected={selectedPage === pageNumber && selectedBank === index}
										/>
									)
								})}
						</CCol>
					)
				})}
		</div>
	)
}

function ButtonGridIcon(props) {
	const context = useContext(CompanionContext)
	const [{ isOver, canDrop }, drop] = useDrop({
		accept: 'preset',
		drop: (dropData) => {
			console.log('preset drop', dropData)
			context.socket.emit('preset_drop', dropData.instanceId, dropData.preset, props.page, props.index)
		},
		collect: (monitor) => ({
			isOver: !!monitor.isOver(),
			canDrop: !!monitor.canDrop(),
		}),
	})

	const title = `${props.page}.${props.index}`
	return <BankPreview {...props} dropRef={drop} dropHover={isOver} canDrop={canDrop} alt={title} title={title} />
}
