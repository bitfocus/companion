import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { CModal, CModalBody, CModalHeader, CModalFooter, CButton, CRow, CCol } from '@coreui/react'
import { VariablesTable } from '../Components/VariablesTable'

export interface ConnectionVariablesModalRef {
	show(label: string): void
}

export const ConnectionVariablesModal = forwardRef<ConnectionVariablesModalRef>(
	function ConnectionVariablesModal(_props, ref) {
		const [connectionLabel, setConnectionLabel] = useState<string | null>(null)
		const [show, setShow] = useState(false)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => setConnectionLabel(null), [])

		useImperativeHandle(
			ref,
			() => ({
				show(label) {
					setConnectionLabel(label)
					setShow(true)
				},
			}),
			[]
		)

		return (
			<CModal show={show} onClose={doClose} onClosed={onClosed} size="lg">
				<CModalHeader closeButton>
					<h5>Variables for {connectionLabel}</h5>
				</CModalHeader>
				<CModalBody>
					<CRow>
						<CCol lg={12}>{connectionLabel && <VariablesTable label={connectionLabel} />}</CCol>
					</CRow>
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Close
					</CButton>
				</CModalFooter>
			</CModal>
		)
	}
)
