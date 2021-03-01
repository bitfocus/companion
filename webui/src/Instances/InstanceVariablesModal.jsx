import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { CModal, CModalBody, CModalHeader, CModalFooter, CButton, CRow, CCol } from '@coreui/react'
import { VariablesTable } from '../Components/VariablesTable'

export const InstanceVariablesModal = forwardRef(function HelpModal(_props, ref) {
	const [instanceLabel, setInstanceLabel] = useState(null)
	const [show, setShow] = useState(false)

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => setInstanceLabel(null), [])

	useImperativeHandle(
		ref,
		() => ({
			show(label) {
				setInstanceLabel(label)
				setShow(true)
			},
		}),
		[]
	)

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed} size="lg">
			<CModalHeader closeButton>
				<h5>Variables for {instanceLabel}</h5>
			</CModalHeader>
			<CModalBody>
				<CRow>
					<CCol lg={12}>
						<VariablesTable label={instanceLabel} />
					</CCol>
				</CRow>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Close
				</CButton>
			</CModalFooter>
		</CModal>
	)
})
