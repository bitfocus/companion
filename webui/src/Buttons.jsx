import { CButton, CCol, CInput, CRow } from '@coreui/react'
import React from 'react'
import { CompanionContext, socketEmit } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsAlt, faChevronLeft, faChevronRight, faCopy, faEraser, faFileExport, faTrash } from '@fortawesome/free-solid-svg-icons'
import classnames from 'classnames'

import { MAX_COLS, MAX_ROWS, MAX_BUTTONS, PREVIEW_BMP_HEADER } from './Constants'


function dataToButtonImage(data) {
    const sourceData = Buffer.from(data);

    const convertedData = Buffer.alloc(sourceData.length)
    for (let i = 0; i < sourceData.length; i += 3) {
        // convert bgr to rgb 
        convertedData.writeUInt8(sourceData.readUInt8(i), i + 2)
        convertedData.writeUInt8(sourceData.readUInt8(i + 1), i + 1)
        convertedData.writeUInt8(sourceData.readUInt8(i + 2), i)
    }

    return 'data:image/bmp;base64,' + Buffer.concat([PREVIEW_BMP_HEADER, convertedData]).toString('base64')
}

export class Buttons extends React.Component {
    static contextType = CompanionContext

    state = {
        loaded: false,
        pageNumber: 1,
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
        const currentIndex = pageNumbers.findIndex(p => p === this.state.pageNumber+'')
        let newPage = pageNumbers[0]
        if (currentIndex !== -1) {
            let newIndex = currentIndex + delta
            if (newIndex < 0) newIndex += pageNumbers.length
            if (newIndex >= pageNumbers.length) newIndex -= pageNumbers.length

            newPage = pageNumbers[newIndex]
        }

        if (newPage !== undefined) {
            this.setState({ pageNumber: newPage})
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

    bankClick = (index) => {
        console.log('clicked', this.state.pageNumber, index)
        switch(this.state.activeFunction) {
            case 'delete':
                if (window.confirm("Clear style and actions for this button?")) {
                    this.context.socket.emit('bank_reset', this.state.pageNumber, index);
                    // socket.emit('bank_actions_get', function_detail.first.page, function_detail.first.bank );
                    // socket.emit('bank_release_actions_get', function_detail.first.page, function_detail.first.bank );
                    // bank_preview_page(page);
                }

                this.stopFunction()
                break
            case 'copy':
                if (this.state.activeFunctionBank) {
                    const fromInfo = this.state.activeFunctionBank
                    this.context.socket.emit('bank_copy', fromInfo.page, fromInfo.bank, this.state.pageNumber, index);
                    this.stopFunction()
                } else {
                    this.setState({
                        activeFunctionBank: {
                            page: this.state.pageNumber,
                            bank: index
                        }
                    })
                }
                break
            case 'move':
                if (this.state.activeFunctionBank) {
                    const fromInfo = this.state.activeFunctionBank
                    this.context.socket.emit('bank_move', fromInfo.page, fromInfo.bank, this.state.pageNumber, index);
                    this.stopFunction()
                } else {
                    this.setState({
                        activeFunctionBank: {
                            page: this.state.pageNumber,
                            bank: index
                        }
                    })
                }
                break
            default:
                // show bank edit page
                this.props.editBank(this.state.pageNumber, index)
                break
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
        const page = this.state.pageNumber
        if (window.confirm(`Are you sure you want to clear all buttons on page ${page}?\nThere\'s no going back from this.`)) {
			this.context.socket.emit('loadsave_reset_page_all', page);
		}
    }
    resetPageNav = () => {
        const page = this.state.pageNumber
        if (window.confirm(`Are you sure you want to reset navigation buttons? This will completely erase bank ${page}.1, ${page}.9 and ${page}.17`)) {
			this.context.socket.emit('loadsave_reset_page_nav', page);
		}
    }

    render() {
        if (!this.state.loaded) {
            return <p>Loading...</p>
        }

        const { pageNumber, pages, newPageName } = this.state

        const pageInfo = pages[pageNumber]
        const pageName = pageInfo?.name ?? 'PAGE'

        return <>
            <h4>Button layout</h4>
            <p>The squares below represent each button on your Streamdeck. Click on them to set up how you want them to look, and what they should do when you press or click on them.</p><p>You can navigate between pages using the arrow buttons, or by clicking the page number, typing in a number, and pressing 'Enter' on your keyboard.</p>

            <CRow>
                <CCol sm={12}>
                    <CButton color="primary" onClick={() => this.changePage(-1)}><FontAwesomeIcon icon={faChevronLeft} /></CButton>
                    <CInput type="text" placeholder={pageNumber} /> {/* TODO editing this */}
                    <CButton color="primary" onClick={() => this.changePage(1)}><FontAwesomeIcon icon={faChevronRight} /></CButton>
                    <CInput
                        className="page_title"
                        type="text"
                        placeholder="Page name"
                        value={newPageName ?? pageName}
                        onBlur={() => this.setState({ newPageName: null })}
                        onChange={(e) => {
                            this.context.socket.emit('set_page', pageNumber, {
                                ...pageInfo,
                                name: e.currentTarget.value,
                            })
                            this.setState({ newPageName: e.currentTarget.value })
                        }}
                    />
                </CCol>
            </CRow>

            <CRow id="pagebank">
                <BankGrid pageNumber={pageNumber} onBankClick={this.bankClick} />
            </CRow>

            <CRow style={{paddingTop:'15px'}}>
                <CCol sm={12} id="functionkeys">
                    {/* TODO - these */}
                    {this.getButton('Copy', faCopy, 'copy')}
                    {this.getButton('Move', faArrowsAlt, 'move')}
                    {this.getButton('Delete', faTrash, 'delete')}
                    <CButton color="danger" onClick={() => this.stopFunction()} style={{ display: this.state.activeFunction ? '' : 'none'}}>Cancel</CButton>
                    <CButton color="disabled" style={{ display: this.state.activeFunction ? '' : 'none'}}>
                        { this.hintButtonText()}
                    </CButton>
                    <span id='state_hide'>
                        <CButton color="warning" onClick={() => this.resetPage()}><FontAwesomeIcon icon={faEraser} /> Wipe page</CButton>
                        <CButton color="warning" onClick={() => this.resetPageNav()}><FontAwesomeIcon icon={faEraser} /> Reset page buttons</CButton><br/><br/>
                        <a href={`/int/page_export/${pageNumber}`} className="btn btn-success buttonbottompad"><FontAwesomeIcon icon={faFileExport} /> Export page</a>

                    </span>
                </CCol>
            </CRow>
        </>
    }
}

export class BankGrid extends React.PureComponent {

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
        const { pageNumber } = this.props

        return <>
            {
                Array(MAX_ROWS).fill(0).map((_, y) => {
                    return <div key={y} className="pagebank-row">
                        {
                            Array(MAX_COLS).fill(0).map((_, x) => {
                                const index = y * MAX_COLS + x + 1
                                return (
                                    <BankPreview key={x} page={pageNumber} index={index} preview={imageCache[index]?.image} onClick={this.props.onBankClick} />
                                )
                            })
                        }
                    </div>
                })
            }
        </>
    }
}

export class BankPreview extends React.PureComponent {
    render() {
        return (
            <div className="bank" onClick={() => this.props.onClick(this.props.index)}>
                <div className="bank-border">
                    <img width={72} height={72} src={this.props.preview} alt={`Bank ${this.props.index}`} />
                </div>
            </div>
        )
    }
}