import { CButton, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'

export const GenericConfirmModal = forwardRef(function GenericConfirmModal(_props, ref) {
	const [data, setData] = useState(null)
	const [show, setShow] = useState(false)

	const buttonRef = useRef()

	const buttonFocus = () => {
		if (buttonRef.current) {
			buttonRef.current.focus()
		}
	}

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => setData(null), [])
	const doAction = useCallback(() => {
		setData(null)
		setShow(false)

		// completion callback
		const cb = data?.[3]
		cb()
	}, [data])

	useImperativeHandle(
		ref,
		() => ({
			show(title, message, buttonLabel, completeCallback) {
				setData([title, message, buttonLabel, completeCallback])
				setShow(true)

				// Focus the button asap. It also gets focused once the open is complete
				setTimeout(buttonFocus, 50)
			},
		}),
		[]
	)

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
			<CModalHeader closeButton>
				<h5>{data?.[0]}</h5>
			</CModalHeader>
			<CModalBody>
				<p>{data?.[1]}</p>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Cancel
				</CButton>
				<CButton innerRef={buttonRef} color="primary" onClick={doAction}>
					{data?.[2]}
				</CButton>
			</CModalFooter>
		</CModal>
	)
})
