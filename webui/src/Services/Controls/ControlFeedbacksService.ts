import { useContext, useMemo, useRef } from 'react'
import { SocketContext, socketEmitPromise } from '../../util'
import { FeedbackInstance } from '@companion/shared/Model/FeedbackModel'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal'

export interface IFeedbackEditorService {
	addFeedback: (feedbackType: string) => void
	moveCard: (dragIndex: number, hoverIndex: number) => void

	setValue: (feedbackId: string, feedback: FeedbackInstance | undefined, key: string, value: any) => void
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
			addFeedback: (feedbackType: string) => {
				const [connectionId, feedbackId] = feedbackType.split(':', 2)
				socketEmitPromise(socket, 'controls:feedback:add', [controlId, connectionId, feedbackId]).catch((e) => {
					console.error('Failed to add control feedback', e)
				})
			},
			moveCard: (dragIndex: number, hoverIndex: number) => {
				socketEmitPromise(socket, 'controls:feedback:reorder', [controlId, dragIndex, hoverIndex]).catch((e) => {
					console.error(`Move failed: ${e}`)
				})
			},

			setValue: (feedbackId: string, feedback: FeedbackInstance | undefined, key: string, val: any) => {
				if (!feedback?.options || feedback.options[key] !== val) {
					socketEmitPromise(socket, 'controls:feedback:set-option', [controlId, feedbackId, key, val]).catch((e) => {
						console.error(`Set-option failed: ${e}`)
					})
				}
			},

			setInverted: (feedbackId: string, isInverted: boolean) => {
				socketEmitPromise(socket, 'controls:feedback:set-inverted', [controlId, feedbackId, isInverted]).catch((e) => {
					console.error(`Set-inverted failed: ${e}`)
				})
			},

			performDelete: (feedbackId: string) => {
				confirmModal.current?.show(`Delete ${entityType}`, `Delete ${entityType}?`, 'Delete', () => {
					socketEmitPromise(socket, 'controls:feedback:remove', [controlId, feedbackId]).catch((e) => {
						console.error(`Failed to delete feedback: ${e}`)
					})
				})
			},

			performDuplicate: (feedbackId: string) => {
				socketEmitPromise(socket, 'controls:feedback:duplicate', [controlId, feedbackId]).catch((e) => {
					console.error(`Failed to duplicate feedback: ${e}`)
				})
			},

			performLearn: (feedbackId: string) => {
				socketEmitPromise(socket, 'controls:feedback:learn', [controlId, feedbackId]).catch((e) => {
					console.error(`Failed to learn feedback values: ${e}`)
				})
			},

			setSelectedStyleProps: (feedbackId: string, selected: string[]) => {
				socketEmitPromise(socket, 'controls:feedback:set-style-selection', [controlId, feedbackId, selected]).catch(
					(e) => {
						console.error(`Failed: ${e}`)
					}
				)
			},

			setStylePropsValue: (feedbackId: string, key: string, value: any) => {
				socketEmitPromise(socket, 'controls:feedback:set-style-value', [controlId, feedbackId, key, value]).catch(
					(e) => {
						console.error(`Failed: ${e}`)
					}
				)
			},

			setEnabled: (feedbackId: string, enabled: boolean) => {
				socketEmitPromise(socket, 'controls:feedback:enabled', [controlId, feedbackId, enabled]).catch((e) => {
					console.error('Failed to enable/disable feedback', e)
				})
			},

			setHeadline: (feedbackId: string, headline: string) => {
				socketEmitPromise(socket, 'controls:feedback:set-headline', [controlId, feedbackId, headline]).catch((e) => {
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
