import { observer } from 'mobx-react-lite'
import { useContext, useId } from 'react'
import { CUSTOM_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { ParseControlId } from '@companion-app/shared/ControlId.js'
import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'
import { getCustomActionCallsExcludedFrom } from '@companion-app/shared/Model/CustomActionModel.js'
import { getCustomFeedbackCallsExcludedFrom } from '@companion-app/shared/Model/CustomFeedbackModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { DropdownChoicesOrGroups } from '~/Components/DropdownChoices.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { groupItemsByCollection } from '~/Helpers/CollectionGrouping'
import { assertNever, useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useEntityEditorContext } from './EntityEditorContext.js'

interface EntityChangeCustomDefinitionProps {
	entityType: EntityModelType
	definitionId: string
	setDefinitionId: (definitionId: string) => void
}

interface CustomDefinitionItem {
	id: string
	name: string
	sortOrder: number
	collectionId: string | null
}

/**
 * Choose which custom action or feedback an entity uses, so that one whose custom action or feedback has gone can be
 * pointed at another
 */
export const EntityChangeCustomDefinition = observer(function EntityChangeCustomDefinition({
	entityType,
	definitionId,
	setDefinitionId,
}: EntityChangeCustomDefinitionProps) {
	const { controlId, readonly } = useEntityEditorContext()
	const { customActionsList, customFeedbacksList } = useContext(RootAppStoreContext)

	const choices = useComputed((): DropdownChoicesOrGroups<string> => {
		// Those which would come back to the custom action or feedback being edited can't be chosen, just as they can't
		// be added
		switch (entityType) {
			case EntityModelType.Action:
				return groupCustomDefinitions(
					customActionsList.rootCollections(),
					Array.from(customActionsList.customActions.entries()).flatMap(([otherControlId, info]) => {
						const parsedId = ParseControlId(otherControlId)
						if (parsedId?.type !== 'custom-action') return []
						return [{ ...info, id: parsedId.customActionId, collectionId: info.collectionId ?? null }]
					}),
					getCustomActionCallsExcludedFrom(controlId, customActionsList.customActions.entries()),
					definitionId
				)
			case EntityModelType.Feedback:
				return groupCustomDefinitions(
					customFeedbacksList.rootCollections(),
					Array.from(customFeedbacksList.customFeedbacks.entries()).flatMap(([otherControlId, info]) => {
						const parsedId = ParseControlId(otherControlId)
						if (parsedId?.type !== 'custom-feedback') return []
						return [{ ...info, id: parsedId.customFeedbackId, collectionId: info.collectionId ?? null }]
					}),
					getCustomFeedbackCallsExcludedFrom(controlId, customFeedbacksList.customFeedbacks.entries()),
					definitionId
				)
			default:
				assertNever(entityType)
				return []
		}
	}, [customActionsList, customFeedbacksList, controlId, entityType, definitionId])

	const fieldId = useId()

	return (
		<>
			<FormLabel htmlFor={fieldId} sm={4} column="sm">
				{entityType === EntityModelType.Feedback ? 'Custom feedback' : 'Custom action'}
			</FormLabel>
			<Grid.Col sm={8}>
				<DropdownInputField
					htmlName={fieldId}
					choices={choices}
					value={definitionId}
					setValue={setDefinitionId}
					disabled={readonly}
				/>
			</Grid.Col>
		</>
	)
})

/**
 * Group the custom actions or feedbacks by collection, leaving out those which can't be chosen, unless already chosen
 */
function groupCustomDefinitions(
	rootCollections: CollectionBase<unknown>[],
	items: CustomDefinitionItem[],
	excludedIds: ReadonlySet<string>,
	currentId: string
): DropdownChoicesOrGroups<string> {
	return groupItemsByCollection(
		rootCollections,
		items,
		(item) => ({ id: item.id, label: item.name }),
		(item) => item.id === currentId || !excludedIds.has(`${CUSTOM_CONNECTION_ID}:${item.id}`)
	)
}
