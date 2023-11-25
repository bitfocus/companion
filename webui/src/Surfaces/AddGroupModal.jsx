import React, { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import {
	CButton,
	CForm,
	CFormGroup,
	CInput,
	CLabel,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
} from '@coreui/react'
import { socketEmitPromise, SocketContext, PreventDefaultHandler } from '../util'

export const AddSurfaceGroupModal = forwardRef(function SurfaceEditModal(_props, ref) {
	const socket = useContext(SocketContext)

	const [show, setShow] = useState(false)

	const [groupName, setGroupName] = useState(null)

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setGroupName(null)
	}, [])

	const doAction = useCallback(
		(e) => {
			if (e) e.preventDefault()

			if (!groupName) return

			setShow(false)
			setGroupName(null)

			socketEmitPromise(socket, 'surfaces:group-add', [groupName]).catch((err) => {
				console.error('Group add failed', err)
			})
		},
		[groupName]
	)

	useImperativeHandle(
		ref,
		() => ({
			show() {
				setShow(true)
				setGroupName('My group')
			},
		}),
		[]
	)

	const onNameChange = useCallback((e) => setGroupName(e.target.value), [])

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed}>
			<CModalHeader closeButton>
				<h5>Add Surface Group</h5>
			</CModalHeader>
			<CModalBody>
				<CForm onSubmit={PreventDefaultHandler}>
					<CFormGroup>
						<CLabel>Name</CLabel>
						<CInput type="text" value={groupName || ''} onChange={onNameChange} />
					</CFormGroup>
				</CForm>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Cancel
				</CButton>
				<CButton color="primary" onClick={doAction}>
					Save
				</CButton>
			</CModalFooter>
		</CModal>
	)
})
