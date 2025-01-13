import { useContext, useMemo, useRef } from 'react'
import { SocketContext } from '../../util.js'
import { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'

export interface IFeedbackEditorService {
	addFeedback: (feedbackType: string, parentId: string | null) => void
	moveCard: (dragId: string, hoverParentId: string | null, hoverIndex: number) => void

	setValue: (feedbackId: string, feedback: FeedbackInstance | undefined, key: string, value: any) => void
	setConnection: (feedbackId: string, connectionId: string | number) => void
	setInverted: (feedbackId: string, inverted: boolean) => void
	performDelete: (feedbackId: string) => void
	performDuplicate: (feedbackId: string) => void
	performLearn: (feedbackId: string) => void
	setSelectedStyleProps: (feedbackId: string, keys: string[]) => void
	setStylePropsValue: (feedbackId: string, key: string, value: any) => void
	setEnabled: (feedbackId: string, enabled: boolean) => void
	setHeadline: ((feedbackId: string, headline: string) => void) | undefined
}

export interface IFeedbackEditorFeedbackService {
	setValue: (key: string, value: any) => void
	setConnection: (connectionId: string | number) => void
	setInverted: (inverted: boolean) => void
	performDelete: () => void
	performDuplicate: () => void
	performLearn: () => void
	setSelectedStyleProps: (keys: string[]) => void
	setStylePropsValue: (key: string, value: any) => void
	setEnabled: (enabled: boolean) => void
	setHeadline: ((headline: string) => void) | undefined
}

export function useControlFeedbacksEditorService(
	controlId: string,
	confirmModal: React.RefObject<GenericConfirmModalRef>,
	entityType: string
): IFeedbackEditorService {
	const socket = useContext(SocketContext)

	return useMemo(
		() => ({
			addFeedback: (feedbackType: string, parentId: string | null) => {
				const [connectionId, feedbackId] = feedbackType.split(':', 2)
				socket.emitPromise('controls:feedback:add', [controlId, parentId, connectionId, feedbackId]).catch((e) => {
					console.error('Failed to add control feedback', e)
				})
			},
			moveCard: (dragFeedbackId: string, hoverParentId: string | null, hoverIndex: number) => {
				socket
					.emitPromise('controls:feedback:move', [controlId, dragFeedbackId, hoverParentId, hoverIndex])
					.catch((e) => {
						console.error(`Move failed: ${e}`)
					})
			},

			setValue: (feedbackId: string, feedback: FeedbackInstance | undefined, key: string, val: any) => {
				if (!feedback?.options || feedback.options[key] !== val) {
					socket.emitPromise('controls:feedback:set-option', [controlId, feedbackId, key, val]).catch((e) => {
						console.error(`Set-option failed: ${e}`)
					})
				}
			},

			setConnection: (feedbackId: string, connectionId: string | number) => {
				socket.emitPromise('controls:feedback:set-connection', [controlId, feedbackId, connectionId]).catch((e) => {
					console.error(`Set-connection failed: ${e}`)
				})
			},

			setInverted: (feedbackId: string, isInverted: boolean) => {
				socket.emitPromise('controls:feedback:set-inverted', [controlId, feedbackId, isInverted]).catch((e) => {
					console.error(`Set-inverted failed: ${e}`)
				})
			},

			performDelete: (feedbackId: string) => {
				confirmModal.current?.show(`Delete ${entityType}`, `Delete ${entityType}?`, 'Delete', () => {
					socket.emitPromise('controls:feedback:remove', [controlId, feedbackId]).catch((e) => {
						console.error(`Failed to delete feedback: ${e}`)
					})
				})
			},

			performDuplicate: (feedbackId: string) => {
				socket.emitPromise('controls:feedback:duplicate', [controlId, feedbackId]).catch((e) => {
					console.error(`Failed to duplicate feedback: ${e}`)
				})
			},

			performLearn: (feedbackId: string) => {
				socket.emitPromise('controls:feedback:learn', [controlId, feedbackId]).catch((e) => {
					console.error(`Failed to learn feedback values: ${e}`)
				})
			},

			setSelectedStyleProps: (feedbackId: string, selected: string[]) => {
				socket.emitPromise('controls:feedback:set-style-selection', [controlId, feedbackId, selected]).catch((e) => {
					console.error(`Failed: ${e}`)
				})
			},

			setStylePropsValue: (feedbackId: string, key: string, value: any) => {
				socket.emitPromise('controls:feedback:set-style-value', [controlId, feedbackId, key, value]).catch((e) => {
					console.error(`Failed: ${e}`)
				})
			},

			setEnabled: (feedbackId: string, enabled: boolean) => {
				socket.emitPromise('controls:feedback:enabled', [controlId, feedbackId, enabled]).catch((e) => {
					console.error('Failed to enable/disable feedback', e)
				})
			},

			setHeadline: (feedbackId: string, headline: string) => {
				socket.emitPromise('controls:feedback:set-headline', [controlId, feedbackId, headline]).catch((e) => {
					console.error('Failed to set feedback headline', e)
				})
			},
		}),
		[socket, confirmModal, controlId, entityType]
	)
}

export function useControlFeedbackService(
	serviceFactory: IFeedbackEditorService,
	feedback: FeedbackInstance
): IFeedbackEditorFeedbackService {
	const socket = useContext(SocketContext)

	const feedbackRef = useRef<FeedbackInstance>()
	feedbackRef.current = feedback

	const feedbackId = feedback.id

	return useMemo(
		() => ({
			setValue: (key: string, val: any) => serviceFactory.setValue(feedbackId, feedbackRef.current, key, val),
			setConnection: (connectionId: string | number) => serviceFactory.setConnection(feedbackId, connectionId),
			setInverted: (isInverted: boolean) => serviceFactory.setInverted(feedbackId, isInverted),
			performDelete: () => serviceFactory.performDelete(feedbackId),
			performDuplicate: () => serviceFactory.performDuplicate(feedbackId),
			performLearn: () => serviceFactory.performLearn(feedbackId),
			setSelectedStyleProps: (selected: string[]) => serviceFactory.setSelectedStyleProps(feedbackId, selected),
			setStylePropsValue: (key: string, value: any) => serviceFactory.setStylePropsValue(feedbackId, key, value),
			setEnabled: (enabled: boolean) => serviceFactory.setEnabled(feedbackId, enabled),
			setHeadline: serviceFactory.setHeadline
				? (headline: string) => serviceFactory.setHeadline?.(feedbackId, headline)
				: undefined,
		}),
		[socket, serviceFactory, feedbackId]
	)
}
