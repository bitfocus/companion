import React, { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import { CModal, CModalBody, CModalHeader, CModalFooter, CButton, CRow, CCol } from '@coreui/react'
import { CompanionContext } from '../util'

export const InstanceVariablesModal = forwardRef(function HelpModal(_props, ref) {
	const [instanceLabel, setInstanceLabel] = useState(null)
	const [show, setShow] = useState(false)

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => setInstanceLabel(null), [])

	useImperativeHandle(ref, () => ({
		show(label) {
			setInstanceLabel(label)
			setShow(true)
		}
    }), [])
    
	return (
		<CModal
			show={show}
			onClose={doClose}
			onClosed={onClosed}
			size="lg"
		>
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
				<CButton
					color="secondary"
					onClick={doClose}
				>Close</CButton>
			</CModalFooter>
		</CModal>
	)
})

function VariablesTable({ label }) {
	const context = useContext(CompanionContext)
	const variableDefinitions = context.variableDefinitions[label] || []
	const variableValues = context.variableValues || {}

	if (variableDefinitions.length > 0) {
		return (
			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>Variable</th>
						<th>Description</th>
						<th>Current value</th>
					</tr>
				</thead>
				<tbody>
					{
						variableDefinitions.map((variable) => <tr key={variable.name}>
							<td>$({label}:{variable.name})</td>
							<td>{variable.label}</td>
							<td>{variableValues[label + ':' + variable.name]}</td>
						</tr>)
					}
				</tbody>
			</table>
		)
	} else {
		return <p>Instance has no variables</p>
	}
}