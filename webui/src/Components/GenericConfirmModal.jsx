import { CButton, CModal, CModalBody, CModalFooter, CModalHeader } from "@coreui/react"
import { forwardRef, useCallback, useContext, useImperativeHandle, useState } from "react"
import { CompanionContext } from "../util"

export const GenericConfirmModal = forwardRef(function GenericConfirmModal(_props, ref) {
	const context = useContext(CompanionContext)
	
	const [data, setData] = useState(null)
	const [show, setShow] = useState(false)

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => setData(null), [])
	const doReset = useCallback(() => {
		setData(null)
		setShow(false)

		// Perform the reset
        const args = data?.[3]
        console.log(args)
		if (args) {
			context.socket.emit(...args)
        }
        
        // completion callback
        const cb = data?.[4]
        if (typeof cb === 'function') cb() 
	},[data, context.socket])

	useImperativeHandle(ref, () => ({
		show(title, message, buttonLabel, socketArgs, completeCallback) {
			setData([title, message, buttonLabel, socketArgs, completeCallback])
			setShow(true)
		}
	}), [])

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed}>
			<CModalHeader closeButton>
				<h5>{data?.[0]}</h5>
			</CModalHeader>
			<CModalBody>

				<p>{data?.[1]}</p>

			</CModalBody>
			<CModalFooter>
				<CButton
					color="secondary"
					onClick={doClose}
				>Cancel</CButton>
				<CButton
					color="primary"
					onClick={doReset}
				>{data?.[2]}</CButton>
			</CModalFooter>
		</CModal>
	)
})
