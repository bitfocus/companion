import React, { CButton, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { CModalExt } from './CModalExt.js'

export interface GenericConfirmModalRef {
	show(title: string, message: string | string[] | null, buttonLabel: string, completeCallback: () => void): void
}

interface GenericConfirmModalProps {
	content?: string | JSX.Element | JSX.Element[]
}

interface GenericConfirmModalData {
	title: string
	message: string | string[] | null
	buttonLabel: string
	completeCallback: () => void
}

export const GenericConfirmModal = forwardRef<GenericConfirmModalRef, GenericConfirmModalProps>(
	function GenericConfirmModal(props, ref) {
		const [data, setData] = useState<GenericConfirmModalData | null>(null)
		const [show, setShow] = useState(false)

		const buttonRef = useRef<HTMLButtonElement>(null)

		const buttonFocus = () => {
			if (buttonRef.current) {
				buttonRef.current.focus()
			}
		}

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => setData(null), [])
		const doAction = useCallback(() => {
			setShow(false)

			// completion callback
			const cb = data?.completeCallback
			if (cb) cb()
		}, [data])

		useImperativeHandle(
			ref,
			() => ({
				show(title, message, buttonLabel, completeCallback) {
					setData({ title, message, buttonLabel, completeCallback })
					setShow(true)

					// Focus the button asap. It also gets focused once the open is complete
					setTimeout(buttonFocus, 50)
				},
			}),
			[]
		)

		let content: JSX.Element | JSX.Element[] | string = props.content ?? ''
		if (data?.message) {
			if (Array.isArray(data.message)) {
				content = data.message.map((line, i) => <p key={i}>{line}</p>)
			} else {
				content = <p>{data.message}</p>
			}
		}

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus} transition={false}>
				<CModalHeader closeButton>
					<h5>{data?.title}</h5>
				</CModalHeader>
				<CModalBody>{content}</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Cancel
					</CButton>
					<CButton ref={buttonRef} color="primary" onClick={doAction} autoFocus>
						{data?.buttonLabel}
					</CButton>
				</CModalFooter>
			</CModalExt>
		)
	}
)
