import {
	EntityModelType,
	EntityOwner,
	SomeEntityModel,
	stringifySocketEntityLocation,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { useContext, useMemo, useRef } from 'react'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/TRPC'
import { SocketContext } from '~/util.js'

export interface IEntityEditorService {
	readonly listId: SomeSocketEntityLocation
	readonly confirmModal: React.RefObject<GenericConfirmModalRef>

	addEntity: (connectionId: string, definitionId: string, ownerId: EntityOwner | null) => Promise<string | null>

	setValue: (entityId: string, entity: SomeEntityModel | undefined, key: string, val: any) => void
	performDelete: (entityId: string) => void
	performDuplicate: (entityId: string) => void
	setConnection: (entityId: string, connectionId: string) => void
	moveCard: (
		dragListId: SomeSocketEntityLocation,
		dragEntityId: string,
		dropOwnerId: EntityOwner | null,
		dropIndex: number
	) => void
	performLearn: ((entityId: string) => void) | undefined
	setEnabled: ((entityId: string, enabled: boolean) => void) | undefined
	setHeadline: ((entityId: string, headline: string) => void) | undefined

	setInverted: (entityId: string, inverted: boolean) => void
	setSelectedStyleProps: (entityId: string, keys: string[]) => void
	setStylePropsValue: (entityId: string, key: string, value: any) => void
}

export interface IEntityEditorActionService {
	setValue: (key: string, val: any) => void
	performDelete: () => void
	performDuplicate: () => void
	setConnection: (connectionId: string) => void
	performLearn: (() => void) | undefined
	setEnabled: ((enabled: boolean) => void) | undefined
	setHeadline: ((headline: string) => void) | undefined

	setInverted: (inverted: boolean) => void
	setSelectedStyleProps: (keys: string[]) => void
	setStylePropsValue: (key: string, value: any) => void
}

export function useControlEntitiesEditorService(
	controlId: string,
	listId: SomeSocketEntityLocation,
	entityTypeLabel: string,
	entityModelType: EntityModelType,
	confirmModal: React.RefObject<GenericConfirmModalRef>
): IEntityEditorService {
	const socket = useContext(SocketContext)

	const addMutation = useMutationExt(trpc.controls.entities.add.mutationOptions())
	const moveMutation = useMutationExt(trpc.controls.entities.move.mutationOptions())
	const setOptionMutation = useMutationExt(trpc.controls.entities.setOption.mutationOptions())
	const setConnectionMutation = useMutationExt(trpc.controls.entities.setConnection.mutationOptions())
	const removeMutation = useMutationExt(trpc.controls.entities.remove.mutationOptions())
	const duplicateMutation = useMutationExt(trpc.controls.entities.duplicate.mutationOptions())
	const learnOptionsMutation = useMutationExt(trpc.controls.entities.learnOptions.mutationOptions())
	const setEnabledMutation = useMutationExt(trpc.controls.entities.setEnabled.mutationOptions())
	const setHeadlineMutation = useMutationExt(trpc.controls.entities.setHeadline.mutationOptions())
	const setInvertedMutation = useMutationExt(trpc.controls.entities.setInverted.mutationOptions())
	const setStyleSelectionMutation = useMutationExt(trpc.controls.entities.setStyleSelection.mutationOptions())
	const setStyleValueMutation = useMutationExt(trpc.controls.entities.setStyleValue.mutationOptions())

	return useMemo(
		() => ({
			listId,
			confirmModal,

			addEntity: async (connectionId: string, definitionId: string, ownerId: EntityOwner | null) => {
				return addMutation.mutateAsync({
					controlId,
					entityLocation: listId,
					ownerId,
					connectionId,
					entityType: entityModelType,
					entityDefinition: definitionId,
				})
			},

			moveCard: (
				moveEntityLocation: SomeSocketEntityLocation,
				moveEntityId: string,
				newOwnerId: EntityOwner | null,
				newIndex: number
			) => {
				moveMutation
					.mutateAsync({
						controlId,
						moveEntityLocation,
						moveEntityId,
						newOwnerId,
						newEntityLocation: listId,
						newIndex,
					})
					.catch((e) => {
						console.error('Failed to reorder control entities', e)
					})
			},

			setValue: (entityId: string, entity: SomeEntityModel | undefined, key: string, value: any) => {
				if (!entity?.options || entity.options[key] !== value) {
					setOptionMutation
						.mutateAsync({
							controlId,
							entityLocation: listId,
							entityId,
							key,
							value,
						})
						.catch((e) => {
							console.error('Failed to set control entity option', e)
						})
				}
			},

			setConnection: (entityId: string, connectionId: string) => {
				setConnectionMutation
					.mutateAsync({
						controlId,
						entityLocation: listId,
						entityId,
						connectionId,
					})
					.catch((e) => {
						console.error('Failed to set control entity connection', e)
					})
			},

			performDelete: (entityId: string) => {
				confirmModal.current?.show(`Delete ${entityTypeLabel}`, `Delete ${entityTypeLabel}?`, 'Delete', () => {
					removeMutation
						.mutateAsync({
							controlId,
							entityLocation: listId,
							entityId,
						})
						.catch((e) => {
							console.error('Failed to remove control entity', e)
						})
				})
			},

			performDuplicate: (entityId: string) => {
				duplicateMutation
					.mutateAsync({
						controlId,
						entityLocation: listId,
						entityId,
					})
					.catch((e) => {
						console.error('Failed to duplicate control entity', e)
					})
			},

			performLearn: (entityId: string) => {
				learnOptionsMutation
					.mutateAsync({
						controlId,
						entityLocation: listId,
						entityId,
					})
					.catch((e) => {
						console.error('Failed to learn control entity values', e)
					})
			},

			setEnabled: (entityId: string, enabled: boolean) => {
				setEnabledMutation
					.mutateAsync({
						controlId,
						entityLocation: listId,
						entityId,
						enabled,
					})
					.catch((e) => {
						console.error('Failed to enable/disable entity', e)
					})
			},

			setHeadline: (entityId: string, headline: string) => {
				setHeadlineMutation
					.mutateAsync({
						controlId,
						entityLocation: listId,
						entityId,
						headline,
					})
					.catch((e) => {
						console.error('Failed to set entity headline', e)
					})
			},

			setInverted: (entityId: string, isInverted: boolean) => {
				setInvertedMutation
					.mutateAsync({
						controlId,
						entityLocation: listId,
						entityId,
						isInverted,
					})
					.catch((e) => {
						console.error('Failed to set entity inverted', e)
					})
			},

			setSelectedStyleProps: (entityId: string, selected: string[]) => {
				setStyleSelectionMutation
					.mutateAsync({
						controlId,
						entityLocation: listId,
						entityId,
						selected,
					})
					.catch((e) => {
						console.error('Failed to set entity style selected props', e)
					})
			},

			setStylePropsValue: (entityId: string, key: string, value: any) => {
				setStyleValueMutation
					.mutateAsync({
						controlId,
						entityLocation: listId,
						entityId,
						key,
						value,
					})
					.catch((e) => {
						console.error('Failed to set entity style value', e)
					})
			},
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[socket, confirmModal, controlId, stringifySocketEntityLocation(listId), entityTypeLabel, entityModelType]
	)
}

export function useControlEntityService(
	serviceFactory: IEntityEditorService,
	entity: SomeEntityModel
): IEntityEditorActionService {
	const entityRef = useRef<SomeEntityModel>()
	entityRef.current = entity

	const entityId = entity.id

	return useMemo(
		() => ({
			setValue: (key: string, val: any) => serviceFactory.setValue(entityId, entityRef.current, key, val),
			performDelete: () => serviceFactory.performDelete(entityId),
			performDuplicate: () => serviceFactory.performDuplicate(entityId),
			setConnection: (connectionId: string) => serviceFactory.setConnection(entityId, connectionId),
			performLearn: serviceFactory.performLearn ? () => serviceFactory.performLearn?.(entityId) : undefined,
			setEnabled: serviceFactory.setEnabled
				? (enabled: boolean) => serviceFactory.setEnabled?.(entityId, enabled)
				: undefined,
			setHeadline: serviceFactory.setHeadline
				? (headline: string) => serviceFactory.setHeadline?.(entityId, headline)
				: undefined,
			setInverted: (inverted: boolean) => serviceFactory.setInverted(entityId, inverted),
			setSelectedStyleProps: (keys: string[]) => serviceFactory.setSelectedStyleProps(entityId, keys),
			setStylePropsValue: (key: string, value: any) => serviceFactory.setStylePropsValue(entityId, key, value),
		}),
		[serviceFactory, entityId]
	)
}
