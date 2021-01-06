import React from 'react'
import {CModal, CModalBody, CModalHeader, CModalFooter, CButton} from '@coreui/react'


export function HelpModal(props) {
  const content = props.content || []
  return (
    <CModal
    show={!!props.content}
    onClose={props.hide}
    size="lg"
    >
    <CModalHeader closeButton>
        <h5>Help for {content[0]}</h5>
    </CModalHeader>
    <CModalBody>
        <div dangerouslySetInnerHTML={{ __html:content[1]}} />
    </CModalBody>
    <CModalFooter>
        <CButton
        color="secondary"
        onClick={props.hide}
        >Close</CButton>
    </CModalFooter>
    </CModal>
  )
}