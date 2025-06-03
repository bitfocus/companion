import React, {
	ChangeEvent,
	FormEvent,
	forwardRef,
	useCallback,
	useContext,
	useImperativeHandle,
	useState,
} from 'react'
import { CAlert, CButton, CForm, CFormInput, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { SocketContext, PreventDefaultHandler } from '~/util.js'
import { CModalExt } from '~/Components/CModalExt.js'

export interface AddOutboundSurfaceModalRef {
	show(): void
}
interface AddOutboundSurfaceModalProps {
	// Nothing
}

interface FormInfo {
	name: string
	address: string
	port: number | undefined
}

export const AddOutboundSurfaceModal = forwardRef<AddOutboundSurfaceModalRef, AddOutboundSurfaceModalProps>(
	function SurfaceEditModal(_props, ref) {
		const socket = useContext(SocketContext)

		const [show, setShow] = useState(false)
		const [running, setRunning] = useState(false)
		const [saveError, setSaveError] = useState<string | null>(null)

		const [info, setInfo] = useState<FormInfo | null>(null)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => {
			setInfo(null)
			setRunning(false)
			setSaveError(null)
		}, [])

		const doAction = useCallback(
			(e: FormEvent) => {
				if (e) e.preventDefault()

				if (!info) return

				setRunning(true)
				setSaveError(null)

				socket
					.emitPromise('surfaces:outbound:add', ['elgato', info.address, info.port, info.name])
					.then(() => {
						setRunning(false)
						setShow(false)
						setInfo(null)
						setSaveError(null)
					})
					.catch((err) => {
						console.error('Outbound surface add failed', err)
						setRunning(false)
						setSaveError(err?.message ?? err)
					})
			},
			[info]
		)

		useImperativeHandle(
			ref,
			() => ({
				show() {
					setShow(true)
					setInfo({
						name: '',
						address: '',
						port: undefined,
					})
				},
			}),
			[]
		)

		const onNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
			const newName = e.currentTarget.value
			setInfo(
				(oldInfo) =>
					oldInfo && {
						...oldInfo,
						name: newName,
					}
			)
		}, [])

		const onAddressChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
			const newAddress = e.currentTarget.value
			setInfo(
				(oldInfo) =>
					oldInfo && {
						...oldInfo,
						address: newAddress,
					}
			)
		}, [])
		const onPortChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
			const newPort = Number(e.currentTarget.value)
			if (isNaN(newPort)) return

			setInfo(
				(oldInfo) =>
					oldInfo && {
						...oldInfo,
						port: newPort,
					}
			)
		}, [])

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} onShow={() => console.log('show')}>
				<CModalHeader closeButton>
					<h5>Add Stream Deck Studio or Network Dock</h5>
				</CModalHeader>
				<CModalBody>
					<CForm onSubmit={PreventDefaultHandler}>
						{saveError ? <CAlert color="danger">{saveError}</CAlert> : null}

						<CFormInput label="Name" type="text" value={info?.name || ''} onChange={onNameChange} />

						<CFormInput label="Address" type="text" value={info?.address || ''} onChange={onAddressChange} />

						<CFormInput
							label="Port"
							type="number"
							min={1}
							max={65535}
							value={info?.port || ''}
							onChange={onPortChange}
							placeholder="Default port"
						/>
					</CForm>
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Cancel
					</CButton>
					<CButton color="primary" onClick={doAction} disabled={running || !info?.address}>
						Add
					</CButton>
				</CModalFooter>
			</CModalExt>
		)
	}
)
