import { useMemo, useRef } from 'react'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import type { JsonValue } from 'type-fest'

export interface IEventEditorService {
	addEvent: (eventType: DropdownChoiceId) => void
	moveCard: (dragIndex: number, hoverIndex: number) => void

	setValue: (eventId: string, Event: EventInstance | undefined, key: string, value: JsonValue | undefined) => void
	performDelete: (eventId: string) => void
	performDuplicate: (eventId: string) => void
	setEnabled: (eventId: string, enabled: boolean) => void
	setHeadline: ((eventId: string, headline: string) => void) | undefined
}

export interface IEventEditorEventService {
	setValue: (key: string, value: JsonValue | undefined) => void
	performDelete: () => void
	performDuplicate: () => void
	setEnabled: (enabled: boolean) => void
	setHeadline: ((headline: string) => void) | undefined
}

export function useControlEventsEditorService(
	controlId: string,
	confirmModal: React.RefObject<GenericConfirmModalRef>
): IEventEditorService {
	const addMutation = useMutationExt(trpc.controls.events.add.mutationOptions())
	const reorderMutation = useMutationExt(trpc.controls.events.reorder.mutationOptions())
	const setOptionMutation = useMutationExt(trpc.controls.events.setOption.mutationOptions())
	const setEnabledMutation = useMutationExt(trpc.controls.events.setEnabled.mutationOptions())
	const setHeadlineMutation = useMutationExt(trpc.controls.events.setHeadline.mutationOptions())
	const duplicateMutation = useMutationExt(trpc.controls.events.duplicate.mutationOptions())
	const removeMutation = useMutationExt(trpc.controls.events.remove.mutationOptions())

	return useMemo(
		() => ({
			addEvent: (eventType: DropdownChoiceId) => {
				addMutation.mutateAsync({ controlId, eventType: String(eventType) }).catch((e) => {
					console.error('Failed to add trigger event', e)
				})
			},
			moveCard: (dragIndex: number, hoverIndex: number) => {
				reorderMutation.mutateAsync({ controlId, oldIndex: dragIndex, newIndex: hoverIndex }).catch((e) => {
					console.error(`Move failed: ${e}`)
				})
			},

			setValue: (eventId: string, event: EventInstance | undefined, key: string, value: JsonValue | undefined) => {
				if (!event?.options || event.options[key] !== value) {
					setOptionMutation.mutateAsync({ controlId, eventId, key, value }).catch((e) => {
						console.error(`Set-option failed: ${e}`)
					})
				}
			},

			performDelete: (eventId: string) => {
				confirmModal.current?.show('Delete event', 'Delete event?', 'Delete', () => {
					removeMutation.mutateAsync({ controlId, eventId }).catch((e) => {
						console.error(`Failed to delete event: ${e}`)
					})
				})
			},

			performDuplicate: (eventId: string) => {
				duplicateMutation.mutateAsync({ controlId, eventId }).catch((e) => {
					console.error(`Failed to duplicate feeeventdback: ${e}`)
				})
			},

			setEnabled: (eventId: string, enabled: boolean) => {
				setEnabledMutation.mutateAsync({ controlId, eventId, enabled }).catch((e) => {
					console.error('Failed to enable/disable event', e)
				})
			},

			setHeadline: (eventId: string, headline: string) => {
				setHeadlineMutation.mutateAsync({ controlId, eventId, headline }).catch((e) => {
					console.error('Failed to set event headline', e)
				})
			},
		}),
		[
			confirmModal,
			controlId,
			addMutation,
			reorderMutation,
			setOptionMutation,
			setEnabledMutation,
			setHeadlineMutation,
			duplicateMutation,
			removeMutation,
		]
	)
}

export function useControlEventService(
	serviceFactory: IEventEditorService,
	event: EventInstance
): IEventEditorEventService {
	const eventRef = useRef<EventInstance>()
	eventRef.current = event

	const eventId = event.id

	return useMemo(
		() => ({
			setValue: (key: string, val: JsonValue | undefined) =>
				serviceFactory.setValue(eventId, eventRef.current, key, val),
			performDelete: () => serviceFactory.performDelete(eventId),
			performDuplicate: () => serviceFactory.performDuplicate(eventId),
			setEnabled: (enabled: boolean) => serviceFactory.setEnabled(eventId, enabled),
			setHeadline: serviceFactory.setHeadline
				? (headline: string) => serviceFactory.setHeadline?.(eventId, headline)
				: undefined,
		}),
		[serviceFactory, eventId]
	)
}
