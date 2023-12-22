import { useContext, useMemo, useRef } from 'react'
import { SocketContext, socketEmitPromise } from '../../util'
import { EventInstance } from '@companion/shared/Model/EventModel'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal'
import { DropdownChoiceId } from '@companion-module/base'

export interface IEventEditorService {
	addEvent: (eventType: DropdownChoiceId) => void
	moveCard: (dragIndex: number, hoverIndex: number) => void

	setValue: (eventId: string, Event: EventInstance | undefined, key: string, value: any) => void
	performDelete: (eventId: string) => void
	performDuplicate: (eventId: string) => void
	setEnabled: (eventId: string, enabled: boolean) => void
	setHeadline: ((eventId: string, headline: string) => void) | undefined
}

export interface IEventEditorEventService {
	setValue: (key: string, value: any) => void
	performDelete: () => void
	performDuplicate: () => void
	setEnabled: (enabled: boolean) => void
	setHeadline: ((headline: string) => void) | undefined
}

export function useControlEventsEditorService(
	controlId: string,
	confirmModal: React.RefObject<GenericConfirmModalRef>
): IEventEditorService {
	const socket = useContext(SocketContext)

	return useMemo(
		() => ({
			addEvent: (eventType: DropdownChoiceId) => {
				socketEmitPromise(socket, 'controls:event:add', [controlId, eventType]).catch((e) => {
					console.error('Failed to add trigger event', e)
				})
			},
			moveCard: (dragIndex: number, hoverIndex: number) => {
				socketEmitPromise(socket, 'controls:event:reorder', [controlId, dragIndex, hoverIndex]).catch((e) => {
					console.error(`Move failed: ${e}`)
				})
			},

			setValue: (eventId: string, event: EventInstance | undefined, key: string, val: any) => {
				if (!event?.options || event.options[key] !== val) {
					socketEmitPromise(socket, 'controls:event:set-option', [controlId, eventId, key, val]).catch((e) => {
						console.error(`Set-option failed: ${e}`)
					})
				}
			},

			performDelete: (eventId: string) => {
				confirmModal.current?.show('Delete event', 'Delete event?', 'Delete', () => {
					socketEmitPromise(socket, 'controls:event:remove', [controlId, eventId]).catch((e) => {
						console.error(`Failed to delete event: ${e}`)
					})
				})
			},

			performDuplicate: (eventId: string) => {
				socketEmitPromise(socket, 'controls:event:duplicate', [controlId, eventId]).catch((e) => {
					console.error(`Failed to duplicate feeeventdback: ${e}`)
				})
			},

			setEnabled: (eventId: string, enabled: boolean) => {
				socketEmitPromise(socket, 'controls:event:enabled', [controlId, eventId, enabled]).catch((e) => {
					console.error('Failed to enable/disable event', e)
				})
			},

			setHeadline: (eventId: string, headline: string) => {
				socketEmitPromise(socket, 'controls:event:set-headline', [controlId, eventId, headline]).catch((e) => {
					console.error('Failed to set event headline', e)
				})
			},
		}),
		[socket, confirmModal, controlId]
	)
}

export function useControlEventService(
	serviceFactory: IEventEditorService,
	event: EventInstance
): IEventEditorEventService {
	const socket = useContext(SocketContext)

	const eventRef = useRef<EventInstance>()
	eventRef.current = event

	const eventId = event.id

	return useMemo(
		() => ({
			setValue: (key: string, val: any) => serviceFactory.setValue(eventId, eventRef.current, key, val),
			performDelete: () => serviceFactory.performDelete(eventId),
			performDuplicate: () => serviceFactory.performDuplicate(eventId),
			setEnabled: (enabled: boolean) => serviceFactory.setEnabled(eventId, enabled),
			setHeadline: serviceFactory.setHeadline
				? (headline: string) => serviceFactory.setHeadline?.(eventId, headline)
				: undefined,
		}),
		[socket, serviceFactory, eventId]
	)
}
