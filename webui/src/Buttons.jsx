import { CButton, CCol, CInput, CRow } from '@coreui/react'
import React from 'react'
import { CompanionContext, socketEmit } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsAlt, faChevronLeft, faChevronRight, faCopy, faEraser, faFileExport, faTrash } from '@fortawesome/free-solid-svg-icons'

export class Buttons extends React.Component {
    static contextType = CompanionContext

    state = {
        loaded: false,
        pageNumber: 1,
        pages: {},
        newPageName: null,
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
                    <CButton color="primary" onClick={null}><FontAwesomeIcon icon={faChevronLeft} /></CButton>
                    <CInput type="text" placeholder={pageNumber} /> {/* TODO editing this */}
                    <CButton color="primary" onClick={null}><FontAwesomeIcon icon={faChevronRight} /></CButton>
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

            <CRow>pagebank</CRow>

            <CRow style={{paddingTop:'15px'}}>
                <CCol sm={12} id="functionkeys">
                    {/* TODO - these */}
                    <button className="btn btn-primary function-button buttonbottompad" data-function='copy' id='state_copy'><FontAwesomeIcon icon={faCopy} /> Copy</button>
                    <button className="btn btn-primary function-button buttonbottompad" data-function='move' id='state_move'><FontAwesomeIcon icon={faArrowsAlt} /> Move</button>
                    <button className="btn btn-primary function-button buttonbottompad" data-function='delete' id='state_delete'><FontAwesomeIcon icon={faTrash} /> Delete</button>
                    <button className="btn btn-danger buttonbottompad" id='state_abort'>Cancel</button>
                    <button className="btn btn-disabled buttonbottompad" id='state_hint'></button>
                    <span id='state_hide'>
                        <button type="button" id="erase_page_link" className="btn btn-warning buttonbottompad"><FontAwesomeIcon icon={faEraser} /> Wipe page</button>
                        <button type="button" id="reset_nav_link" className="btn btn-warning buttonbottompad"><FontAwesomeIcon icon={faEraser} /> Reset page buttons</button><br/><br/>
                        <a href={`/int/page_export/${pageNumber}`} className="btn btn-success buttonbottompad"><FontAwesomeIcon icon={faFileExport} /> Export page</a>

                    </span>
                </CCol>
            </CRow>
        </>
    }
}

