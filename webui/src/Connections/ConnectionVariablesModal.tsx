import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { CModalBody, CModalHeader, CModalFooter, CButton, CRow, CCol } from '@coreui/react'
import { VariablesTable } from '~/Components/VariablesTable.js'
import { CModalExt } from '~/Components/CModalExt.js'

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
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} size="xl">
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
			</CModalExt>
		)
	}
)
