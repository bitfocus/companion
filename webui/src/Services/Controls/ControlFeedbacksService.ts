import { useContext, useMemo, useRef } from 'react'
import { CompanionSocketType, SocketContext, socketEmitPromise } from '../../util.js'
import { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'

export interface IFeedbackEditorService {
	readonly collapseHelperKey: string
	readonly dragId: string

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

	createChildService: (parentId: string) => IFeedbackEditorService
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

class FeedbackEditorServiceImpl {
	readonly #socket: CompanionSocketType
	readonly #controlId: string
	readonly #confirmModal: React.RefObject<GenericConfirmModalRef>
	readonly #entityType: string

	get controlId(): string {
		return this.#controlId
	}

	constructor(
		socket: CompanionSocketType,
		controlId: string,
		confirmModal: React.RefObject<GenericConfirmModalRef>,
		entityType: string
	) {
		this.#socket = socket
		this.#controlId = controlId
		this.#confirmModal = confirmModal
		this.#entityType = entityType
	}

	addFeedback(parentId: string | null, feedbackType: string) {
		const [connectionId, feedbackId] = feedbackType.split(':', 2)
		socketEmitPromise(this.#socket, 'controls:feedback:add', [
			this.#controlId,
			parentId,
			connectionId,
			feedbackId,
		]).catch((e) => {
			console.error('Failed to add control feedback', e)
		})
	}
	moveCard(dragIndex: number, hoverIndex: number) {
		socketEmitPromise(this.#socket, 'controls:feedback:reorder', [this.#controlId, dragIndex, hoverIndex]).catch(
			(e) => {
				console.error(`Move failed: ${e}`)
			}
		)
	}

	setValue(feedbackId: string, feedback: FeedbackInstance | undefined, key: string, val: any) {
		if (!feedback?.options || feedback.options[key] !== val) {
			socketEmitPromise(this.#socket, 'controls:feedback:set-option', [this.#controlId, feedbackId, key, val]).catch(
				(e) => {
					console.error(`Set-option failed: ${e}`)
				}
			)
		}
	}

	setInverted(feedbackId: string, isInverted: boolean) {
		socketEmitPromise(this.#socket, 'controls:feedback:set-inverted', [this.#controlId, feedbackId, isInverted]).catch(
			(e) => {
				console.error(`Set-inverted failed: ${e}`)
			}
		)
	}

	performDelete(feedbackId: string) {
		this.#confirmModal.current?.show(`Delete ${this.#entityType}`, `Delete ${this.#entityType}?`, 'Delete', () => {
			socketEmitPromise(this.#socket, 'controls:feedback:remove', [this.#controlId, feedbackId]).catch((e) => {
				console.error(`Failed to delete feedback: ${e}`)
			})
		})
	}

	performDuplicate(feedbackId: string) {
		socketEmitPromise(this.#socket, 'controls:feedback:duplicate', [this.#controlId, feedbackId]).catch((e) => {
			console.error(`Failed to duplicate feedback: ${e}`)
		})
	}

	performLearn(feedbackId: string) {
		socketEmitPromise(this.#socket, 'controls:feedback:learn', [this.#controlId, feedbackId]).catch((e) => {
			console.error(`Failed to learn feedback values: ${e}`)
		})
	}

	setSelectedStyleProps(feedbackId: string, selected: string[]) {
		socketEmitPromise(this.#socket, 'controls:feedback:set-style-selection', [
			this.#controlId,
			feedbackId,
			selected,
		]).catch((e) => {
			console.error(`Failed: ${e}`)
		})
	}

	setStylePropsValue(feedbackId: string, key: string, value: any) {
		socketEmitPromise(this.#socket, 'controls:feedback:set-style-value', [
			this.#controlId,
			feedbackId,
			key,
			value,
		]).catch((e) => {
			console.error(`Failed: ${e}`)
		})
	}

	setEnabled(feedbackId: string, enabled: boolean) {
		socketEmitPromise(this.#socket, 'controls:feedback:enabled', [this.#controlId, feedbackId, enabled]).catch((e) => {
			console.error('Failed to enable/disable feedback', e)
		})
	}

	setHeadline(feedbackId: string, headline: string) {
		socketEmitPromise(this.#socket, 'controls:feedback:set-headline', [this.#controlId, feedbackId, headline]).catch(
			(e) => {
				console.error('Failed to set feedback headline', e)
			}
		)
	}
}

function wrapServiceImpl(serviceImpl: FeedbackEditorServiceImpl, parentId: string | null): IFeedbackEditorService {
	let collapseHelperKey = `feedbacks_${serviceImpl.controlId}`
	if (parentId) collapseHelperKey += `_${parentId}`

	return {
		collapseHelperKey: collapseHelperKey,
		dragId: `feedbacks_${serviceImpl.controlId}`, // TODO - confirm this
		addFeedback: (feedbackType: string) => {
			serviceImpl.addFeedback(parentId, feedbackType)
		},
		moveCard: (dragIndex: number, hoverIndex: number) => {
			serviceImpl.moveCard(dragIndex, hoverIndex)
		},

		setValue: (feedbackId: string, feedback: FeedbackInstance | undefined, key: string, val: any) => {
			serviceImpl.setValue(feedbackId, feedback, key, val)
		},

		setInverted: (feedbackId: string, isInverted: boolean) => {
			serviceImpl.setInverted(feedbackId, isInverted)
		},

		performDelete: (feedbackId: string) => {
			serviceImpl.performDelete(feedbackId)
		},

		performDuplicate: (feedbackId: string) => {
			serviceImpl.performDuplicate(feedbackId)
		},

		performLearn: (feedbackId: string) => {
			serviceImpl.performLearn(feedbackId)
		},

		setSelectedStyleProps: (feedbackId: string, selected: string[]) => {
			serviceImpl.setSelectedStyleProps(feedbackId, selected)
		},

		setStylePropsValue: (feedbackId: string, key: string, value: any) => {
			serviceImpl.setStylePropsValue(feedbackId, key, value)
		},

		setEnabled: (feedbackId: string, enabled: boolean) => {
			serviceImpl.setEnabled(feedbackId, enabled)
		},

		setHeadline: (feedbackId: string, headline: string) => {
			serviceImpl.setHeadline(feedbackId, headline)
		},

		createChildService: (parentId: string): IFeedbackEditorService => {
			return wrapServiceImpl(serviceImpl, parentId)
		},
	}
}

export function useControlFeedbacksEditorService(
	controlId: string,
	confirmModal: React.RefObject<GenericConfirmModalRef>,
	entityType: string
): IFeedbackEditorService {
	const socket = useContext(SocketContext)

	const helper = useMemo(
		() => new FeedbackEditorServiceImpl(socket, controlId, confirmModal, entityType),
		[socket, controlId, confirmModal, entityType]
	)

	return useMemo(() => wrapServiceImpl(helper, null), [helper])
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
