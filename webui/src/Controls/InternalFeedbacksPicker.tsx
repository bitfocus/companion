import React, { useMemo } from 'react'
import { IFeedbackEditorService } from '../Services/Controls/ControlFeedbacksService.js'
import { InlineFeedbacksEditor } from './FeedbackEditor.js'

interface InternalFeedbacksPickerProps {
	serviceFactory: IFeedbackEditorService
	parentId: string
	feedbacks: any
}

export function InternalFeedbacksPicker({ serviceFactory, parentId, feedbacks }: InternalFeedbacksPickerProps) {
	const feedbacksService = useMemo(() => serviceFactory.createChildService(parentId), [serviceFactory, parentId])

	return (
		<InlineFeedbacksEditor
			feedbacks={feedbacks ?? []}
			entityType="condition"
			booleanOnly
			location={undefined}
			addPlaceholder="+ Add condition"
			feedbacksService={feedbacksService}
		/>
	)
	// return <>{value}</>
}

// class InlineFeedbacksService implements IFeedbackEditorService {
// 	readonly #parentFeedbackIds: string[]
// 	readonly #setValue: (feedbacks: FeedbackInstance[]) => void

// 	constructor(parentFeedbackIds: string[], setValue: (feedbacks: FeedbackInstance[]) => void) {
// 		this.#parentFeedbackIds = parentFeedbackIds
// 		this.#setValue = setValue

// 		// nocommit I don't like the feel of this approach
// 		// The frontend is going to have to do this merging logic and emit the whole blob as changed
// 		// Then the backend is going to have to be inefficient and either assume everything in the tree has changed,
// 		// or will need to deep diff to figure out what did change.

// 		// Perhaps is would be better if instead of this, the api allows for a better description of where the feedback is,
// 		// as this would allow it to use the same socket.io api, and allow for the subportions.
// 		// It wouldn't be unreasonable for the feedback definition to have a 'usesChildFeedbacks: true' property to enable this
// 		// And the backend could use a static array/set of feedbackIds which support this, to help its logic
// 	}

// 	addFeedback: (feedbackType: string) => void
// 	moveCard: (dragIndex: number, hoverIndex: number) => void
// 	setValue: (feedbackId: string, feedback: FeedbackInstance | undefined, key: string, value: any) => void
// 	setInverted: (feedbackId: string, inverted: boolean) => void
// 	performDelete: (feedbackId: string) => void
// 	performDuplicate: (feedbackId: string) => void
// 	performLearn: (feedbackId: string) => void
// 	setSelectedStyleProps: (feedbackId: string, keys: string[]) => void
// 	setStylePropsValue: (feedbackId: string, key: string, value: any) => void
// 	setEnabled: (feedbackId: string, enabled: boolean) => void
// 	setHeadline: ((feedbackId: string, headline: string) => void) | undefined
// }

// function useInlineFeedbacksService(
// 	controlId: string,
// 	confirmModal: React.RefObject<GenericConfirmModalRef>,
// 	entityType: string,
// 	parentFeedbackIds: string[]
// ): IFeedbackEditorService {
// 	const socket = useContext(SocketContext)

// 	return useMemo(
// 		() => ({
// 			addFeedback: (feedbackType: string) => {
// 				// const [connectionId, feedbackId] = feedbackType.split(':', 2)
// 				// socketEmitPromise(socket, 'controls:feedback:add', [controlId, [], connectionId, feedbackId]).catch((e) => {
// 				// 	console.error('Failed to add control feedback', e)
// 				// })
// 			},
// 			moveCard: (dragIndex: number, hoverIndex: number) => {
// 				// socketEmitPromise(socket, 'controls:feedback:reorder', [controlId, dragIndex, hoverIndex]).catch((e) => {
// 				// 	console.error(`Move failed: ${e}`)
// 				// })
// 			},

// 			setValue: (feedbackId: string, feedback: FeedbackInstance | undefined, key: string, val: any) => {
// 				// if (!feedback?.options || feedback.options[key] !== val) {
// 				// 	socketEmitPromise(socket, 'controls:feedback:set-option', [controlId, feedbackId, key, val]).catch((e) => {
// 				// 		console.error(`Set-option failed: ${e}`)
// 				// 	})
// 				// }
// 			},

// 			setInverted: (feedbackId: string, isInverted: boolean) => {
// 				// socketEmitPromise(socket, 'controls:feedback:set-inverted', [controlId, feedbackId, isInverted]).catch((e) => {
// 				// 	console.error(`Set-inverted failed: ${e}`)
// 				// })
// 			},

// 			performDelete: (feedbackId: string) => {
// 				// confirmModal.current?.show(`Delete ${entityType}`, `Delete ${entityType}?`, 'Delete', () => {
// 				// 	socketEmitPromise(socket, 'controls:feedback:remove', [controlId, feedbackId]).catch((e) => {
// 				// 		console.error(`Failed to delete feedback: ${e}`)
// 				// 	})
// 				// })
// 			},

// 			performDuplicate: (feedbackId: string) => {
// 				// socketEmitPromise(socket, 'controls:feedback:duplicate', [controlId, feedbackId]).catch((e) => {
// 				// 	console.error(`Failed to duplicate feedback: ${e}`)
// 				// })
// 			},

// 			performLearn: (feedbackId: string) => {
// 				// socketEmitPromise(socket, 'controls:feedback:learn', [controlId, feedbackId]).catch((e) => {
// 				// 	console.error(`Failed to learn feedback values: ${e}`)
// 				// })
// 			},

// 			setSelectedStyleProps: (feedbackId: string, selected: string[]) => {
// 				// socketEmitPromise(socket, 'controls:feedback:set-style-selection', [controlId, feedbackId, selected]).catch(
// 				// 	(e) => {
// 				// 		console.error(`Failed: ${e}`)
// 				// 	}
// 				// )
// 			},

// 			setStylePropsValue: (feedbackId: string, key: string, value: any) => {
// 				// socketEmitPromise(socket, 'controls:feedback:set-style-value', [controlId, feedbackId, key, value]).catch(
// 				// 	(e) => {
// 				// 		console.error(`Failed: ${e}`)
// 				// 	}
// 				// )
// 			},

// 			setEnabled: (feedbackId: string, enabled: boolean) => {
// 				// socketEmitPromise(socket, 'controls:feedback:enabled', [controlId, feedbackId, enabled]).catch((e) => {
// 				// 	console.error('Failed to enable/disable feedback', e)
// 				// })
// 			},

// 			setHeadline: (feedbackId: string, headline: string) => {
// 				// socketEmitPromise(socket, 'controls:feedback:set-headline', [controlId, feedbackId, headline]).catch((e) => {
// 				// 	console.error('Failed to set feedback headline', e)
// 				// })
// 			},
// 		}),
// 		[socket, parentFeedbackIds, controlId, entityType]
// 	)
// }
