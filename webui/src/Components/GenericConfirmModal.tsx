import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Button } from '~/Components/Button'
import { Modal } from './Modal.js'

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

		const onOpenChangeComplete = useCallback((open: boolean) => {
			if (!open) setData(null)
		}, [])

		return (
			<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup initialFocus={buttonRef}>
							<Modal.Header closeButton>
								<Modal.Title>{data?.title}</Modal.Title>
							</Modal.Header>
							<Modal.Body>{content}</Modal.Body>
							<Modal.Footer>
								<Modal.Close>Cancel</Modal.Close>
								<Button ref={buttonRef} color="primary" onClick={doAction} autoFocus>
									{data?.buttonLabel}
								</Button>
							</Modal.Footer>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	}
)
