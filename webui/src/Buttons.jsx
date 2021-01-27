import { CButton, CCol, CInput, CInputGroup, CInputGroupAppend, CInputGroupPrepend, CRow } from '@coreui/react'
import React, { useCallback, useContext, useState } from 'react'
import { CompanionContext, KeyReceiver, socketEmit } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsAlt, faChevronLeft, faChevronRight, faCopy, faEraser, faFileExport, faTrash } from '@fortawesome/free-solid-svg-icons'
import classnames from 'classnames'

import { MAX_COLS, MAX_ROWS, MAX_BUTTONS } from './Constants'
import { useDrop } from 'react-dnd'
import { BankPreview, dataToButtonImage } from './Components/BankButton'

export class Buttons extends React.Component {
	static contextType = CompanionContext

	state = {
		loaded: false,
		pages: {},
		newPageName: null,
		activeFunction: null,
		activeFunctionBank: null,
	}

	componentDidMount() {
		socketEmit(this.context.socket, 'get_page_all', []).then(([pages]) => {
			this.setState({
				loaded: true,
				pages: pages,

			})
		}).catch((e) => {
			console.error('Failed to load pages list:', e)
		})

		this.context.socket.on('set_page', this.updatePageInfo)
	}

	componentWillUnmount() {
		this.context.socket.off('set_page', this.updatePageInfo)
	}

	updatePageInfo = (page, info) => {
		this.setState({
			pages: {
				...this.state.pages,
				[page]: info,
			}
		})
	}

	changePage = (delta) => {
		const pageNumbers = Object.keys(this.state.pages)
		const currentIndex = pageNumbers.findIndex(p => p === this.props.pageNumber + '')
		let newPage = pageNumbers[0]
		if (currentIndex !== -1) {
			let newIndex = currentIndex + delta
			if (newIndex < 0) newIndex += pageNumbers.length
			if (newIndex >= pageNumbers.length) newIndex -= pageNumbers.length

			newPage = pageNumbers[newIndex]
		}

		if (newPage !== undefined) {
			this.props.changePage(newPage)
		}
	}

	setPage = (newPage) => {
		const pageNumbers = Object.keys(this.state.pages)
		const newIndex = pageNumbers.findIndex(p => p === newPage + '')
		if (newIndex !== -1) {
			this.props.changePage(newPage)
		}
	}

	startFunction = (func) => {
		if (this.state.activeFunction === null) {
			this.setState({
				activeFunction: func,
				activeFunctionBank: null,
			})
		}
	}
	stopFunction = () => {
		this.setState({
			activeFunction: null,
			activeFunctionBank: null,
		})
	}

	bankClick = (index, isDown) => {
		console.log('bank', this.props.pageNumber, index, isDown)
		if (isDown) {
			switch (this.state.activeFunction) {
				case 'delete':
					if (window.confirm("Clear style and actions for this button?")) {
						this.context.socket.emit('bank_reset', this.props.pageNumber, index);
						// socket.emit('bank_actions_get', function_detail.first.page, function_detail.first.bank );
						// socket.emit('bank_release_actions_get', function_detail.first.page, function_detail.first.bank );
						// bank_preview_page(page);
					}

					this.stopFunction()
					break
				case 'copy':
					if (this.state.activeFunctionBank) {
						const fromInfo = this.state.activeFunctionBank
						this.context.socket.emit('bank_copy', fromInfo.page, fromInfo.bank, this.props.pageNumber, index);
						this.stopFunction()
					} else {
						this.setState({
							activeFunctionBank: {
								page: this.props.pageNumber,
								bank: index
							}
						})
					}
					break
				case 'move':
					if (this.state.activeFunctionBank) {
						const fromInfo = this.state.activeFunctionBank
						this.context.socket.emit('bank_move', fromInfo.page, fromInfo.bank, this.props.pageNumber, index);
						this.stopFunction()
					} else {
						this.setState({
							activeFunctionBank: {
								page: this.props.pageNumber,
								bank: index
							}
						})
					}
					break
				default:
					// show bank edit page
					this.props.buttonGridClick(this.props.pageNumber, index, true)
					break
			}
		} else if (!this.state.activeFunction) {
			this.props.buttonGridClick(this.props.pageNumber, index, false)
		}
	}

	hintButtonText() {
		if (this.state.activeFunction) {
			if (!this.state.activeFunctionBank) {
				return `Press the button you want to ${this.state.activeFunction}`
			} else {
				return `Where do you want it?`
			}
		} else {
			return ''
		}
	}

	getButton(label, icon, func) {
		let color = 'primary'
		let disabled = false
		if (this.state.activeFunction === func) {
			color = 'success'
		} else if (this.state.activeFunction) {
			disabled = true
		}

		return <CButton
			color={color}
			disabled={disabled}
			onClick={() => this.startFunction(func)}
		><FontAwesomeIcon icon={icon} /> {label}</CButton>
	}

	resetPage = () => {
		const page = this.props.pageNumber
		if (window.confirm(`Are you sure you want to clear all buttons on page ${page}?\nThere's no going back from this.`)) {
			this.context.socket.emit('loadsave_reset_page_all', page);
		}
	}
	resetPageNav = () => {
		const page = this.props.pageNumber
		if (window.confirm(`Are you sure you want to reset navigation buttons? This will completely erase bank ${page}.1, ${page}.9 and ${page}.17`)) {
			this.context.socket.emit('loadsave_reset_page_nav', page);
		}
	}

	render() {
		if (!this.state.loaded) {
			return <p>Loading...</p>
		}

		const { pages, newPageName } = this.state
		const { pageNumber } = this.props

		const pageInfo = pages[pageNumber]
		const pageName = pageInfo?.name ?? 'PAGE'

		return <KeyReceiver onKeyUp={this.props.onKeyUp} tabIndex={0}>
			<h4>
				Button layout
				<CButton color='success' href={`/int/page_export/${pageNumber}`} target="_new" size="sm" className="button-page-export">
					<FontAwesomeIcon icon={faFileExport} /> Export page
				</CButton>
			</h4>
			<p>The squares below represent each button on your Streamdeck. Click on them to set up how you want them to look, and what they should do when you press or click on them.</p><p>You can navigate between pages using the arrow buttons, or by clicking the page number, typing in a number, and pressing 'Enter' on your keyboard.</p>

			<CRow>
				<CCol sm={12}>
					<BankGridHeader 
						pageNumber={pageNumber}
						pageName={newPageName ?? pageName}
						changePage={this.changePage}
						setPage={this.setPage}
						onNameBlur={() => this.setState({ newPageName: null })}
						onNameChange={(e) => {
							this.context.socket.emit('set_page', pageNumber, {
								...pageInfo,
								name: e.currentTarget.value,
							})
							this.setState({ newPageName: e.currentTarget.value })
						}}
					/>
				</CCol>
			</CRow>

			<CRow id="pagebank" className={classnames({ 'bank-armed': this.props.isHot })}>
				<BankGrid pageNumber={pageNumber} bankClick={this.bankClick} selectedButton={this.props.selectedButton} />
			</CRow>

			<CRow style={{ paddingTop: '15px' }}>
				<CCol sm={12} className={classnames({ 'slide-up': this.props.isHot, 'slide-height': true })}>
					{this.getButton('Copy', faCopy, 'copy')}
					{this.getButton('Move', faArrowsAlt, 'move')}
					{this.getButton('Delete', faTrash, 'delete')}
					<CButton color="danger" onClick={() => this.stopFunction()} style={{ display: this.state.activeFunction ? '' : 'none' }}>Cancel</CButton>
					<CButton color="disabled" hidden={!this.state.activeFunction}>{this.hintButtonText()}</CButton>
						
					&nbsp;

					<span>
						<CButton color="warning" onClick={() => this.resetPage()}><FontAwesomeIcon icon={faEraser} /> Wipe page</CButton>
						<CButton color="warning" onClick={() => this.resetPageNav()}><FontAwesomeIcon icon={faEraser} /> Reset page buttons</CButton><br /><br />
						
					</span>
				</CCol>
			</CRow>
		</KeyReceiver>
	}
}

export function BankGridHeader({ pageNumber, pageName, onNameChange, onNameBlur, changePage, setPage }) {
	const [tmpText, setTmpText] = useState(null)

	const inputChange = useCallback((e) => {
		const number = parseInt(e.currentTarget.value)
		if (number > 0) {
			setTmpText(number)
		} else if (e.currentTarget.value === '') {
			setTmpText(e.currentTarget.value)
		}
	}, [setTmpText]) 
	const inputBlur = useCallback(() => {
		setTmpText(tmpText => {
			if (typeof tmpText === 'number') {
				setPage(tmpText)
			}

			return null
		})
	}, [setTmpText, setPage])
	const inputEnter = useCallback((e) => {
		if (e.key === 'Enter') {
			inputBlur()
		}
	}, [inputBlur])

	return <div className="button-grid-header">
		<CInputGroup>
			<CInputGroupPrepend>
				<CButton color="primary" hidden={!changePage} onClick={() => changePage(-1)}>
					<FontAwesomeIcon icon={faChevronLeft} />
				</CButton>
			</CInputGroupPrepend>
			<CInput
				type="number"
				disabled={!setPage}
				placeholder={pageNumber}
				value={tmpText ?? pageNumber}
				onChange={inputChange}
				onBlur={inputBlur}
				onKeyDown={inputEnter}
			/>
			<CInputGroupAppend>
				<CButton color="primary" hidden={!changePage} onClick={() => changePage(1)}>
					<FontAwesomeIcon icon={faChevronRight} />
				</CButton>
			</CInputGroupAppend>
		</CInputGroup>
		<CInput
			className="page_title"
			type="text"
			placeholder="Page name"
			value={pageName}
			onBlur={onNameBlur}
			onChange={onNameChange}
			disabled={!onNameChange}
		/>
	</div>
}

class BankGrid extends React.PureComponent {

	static contextType = CompanionContext

	state = {
		imageCache: {},
	}

	componentDidMount() {
		this.context.socket.on('preview_page_data', this.updatePreviewImages)
		this.context.socket.emit('bank_preview_page', this.props.pageNumber)
	}

	componentWillUnmount() {
		this.context.socket.off('preview_page_data', this.updatePreviewImages)
	}

	componentDidUpdate(prevProps, prevState) {
		if (prevProps.pageNumber !== this.props.pageNumber) {
			// Inform server of our last updated, so it can skip unchanged previews
			const lastUpdated = {}
			for (const [id, data] of Object.entries(this.state.imageCache)) {
				lastUpdated[id] = { updated: data.updated }
			}
			this.context.socket.emit('bank_preview_page', this.props.pageNumber, lastUpdated)
		}
	}

	updatePreviewImages = (images) => {
		const newImages = { ...this.state.imageCache }
		for (let key = 1; key <= MAX_BUTTONS; ++key) {
			if (images[key] !== undefined) {
				newImages[key] = {
					image: dataToButtonImage(images[key].buffer),
					updated: images[key].updated,
				}
			}
		}

		this.setState({ imageCache: newImages })
	}

	render() {
		const { imageCache } = this.state
		const { pageNumber, selectedButton } = this.props

		const selectedPage = selectedButton ? selectedButton[0] : null
		const selectedBank = selectedButton ? selectedButton[1] : null

		return <>
			{
				Array(MAX_ROWS).fill(0).map((_, y) => {
					return <CCol key={y} sm={12}>
						<div className="pagebank-row">
							{
								Array(MAX_COLS).fill(0).map((_, x) => {
									const index = y * MAX_COLS + x + 1
									return (
										<BankGridPreview
											key={x}
											page={pageNumber}
											index={index}
											preview={imageCache[index]?.image}
											onClick={this.props.bankClick}
											alt={`Bank ${index}`}
											selected={selectedPage === pageNumber && selectedBank === index}
										/>
									)
								})
							}
						</div>
					</CCol>
				})
			}
		</>
	}
}

function BankGridPreview(props) {
	const context = useContext(CompanionContext)
	const [{ isOver, canDrop }, drop] = useDrop({
		accept: 'preset',
		drop: (dropData) => {
			console.log('preset drop', dropData)
			context.socket.emit('preset_drop', dropData.instanceId, dropData.preset, props.page, props.index)
		},
		collect: monitor => ({
			isOver: !!monitor.isOver(),
			canDrop: !!monitor.canDrop()
		}),
	})

	return <BankPreview {...props} dropRef={drop} dropHover={isOver} canDrop={canDrop} />
}
