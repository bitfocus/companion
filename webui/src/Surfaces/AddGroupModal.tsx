import React, {
	ChangeEvent,
	FormEvent,
	forwardRef,
	useCallback,
	useContext,
	useImperativeHandle,
	useState,
} from 'react'
import { CButton, CForm, CFormInput, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { SocketContext, PreventDefaultHandler } from '../util.js'
import { CModalExt } from '../Components/CModalExt.js'

export interface AddSurfaceGroupModalRef {
	show(): void
}
interface AddSurfaceGroupModalProps {
	// Nothing
}

export const AddSurfaceGroupModal = forwardRef<AddSurfaceGroupModalRef, AddSurfaceGroupModalProps>(
	function SurfaceEditModal(_props, ref) {
		const socket = useContext(SocketContext)

		const [show, setShow] = useState(false)

		const [groupName, setGroupName] = useState<string | null>(null)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => {
			setGroupName(null)
		}, [])

		const doAction = useCallback(
			(e: FormEvent) => {
				if (e) e.preventDefault()

				if (!groupName) return

				setShow(false)
				setGroupName(null)

				socket.emitPromise('surfaces:group-add', [groupName]).catch((err) => {
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

		const onNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setGroupName(e.currentTarget.value), [])

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} onShow={() => console.log('show')}>
				<CModalHeader closeButton>
					<h5>Add Surface Group</h5>
				</CModalHeader>
				<CModalBody>
					<CForm onSubmit={PreventDefaultHandler}>
						<CFormInput label="Name" type="text" value={groupName || ''} onChange={onNameChange} />
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
			</CModalExt>
		)
	}
)
