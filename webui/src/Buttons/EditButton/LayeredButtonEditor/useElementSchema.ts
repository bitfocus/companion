import { useContext } from 'react'
import { elementSchemas, type ElementSchemaSection } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import type {
	ButtonGraphicsCompositeElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { createRestrictedGetOptionValue, parseIsVisibleFn } from '~/Hooks/useOptionsAndIsVisible.js'
import type { CompositeElementDefinitionsStore } from '~/Stores/CompositeElementDefinitionsStore.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

/**
 * The property schema for an element, in its canonical order. A composite element's own properties come from
 * its module definition, so they are only available while that connection is loaded.
 */
export function getElementSchemaSections(
	elementProps: Readonly<SomeButtonGraphicsElement>,
	compositeElementDefinitions: CompositeElementDefinitionsStore
): ElementSchemaSection[] | undefined {
	const schema: ElementSchemaSection[] | undefined = elementSchemas[elementProps.type]
	if (!schema) return undefined

	if (elementProps.type === 'composite' && elementProps.connectionId && elementProps.elementId) {
		const compositeDefinition = compositeElementDefinitions.getDefinition(
			elementProps.connectionId,
			elementProps.elementId
		)

		// Combine the common element fields with the custom schema from the composite definition
		if (compositeDefinition) {
			const hiddenFields = getHiddenCompositeOptionFields(elementProps, compositeDefinition.options)
			const fields = compositeDefinition.options.filter((field) => !hiddenFields.has(field.id))
			return [...schema, { id: 'properties', label: 'Properties', fields }]
		}
	}

	return schema
}

/**
 * The ids of a composite element's options which are hidden by their `isVisible` logic.
 *
 * Follows the same rules as entity options: an `isVisible` expression may only read sibling options which can't be
 * expressions (`disableAutoExpression`). The option ids are `opt:` prefixed in the ui definition, but the expressions
 * reference them by the module's own unprefixed ids.
 */
export function getHiddenCompositeOptionFields(
	elementProps: Readonly<ButtonGraphicsCompositeElement>,
	options: ReadonlyArray<SomeCompanionInputField>
): Set<string> {
	const hiddenFields = new Set<string>()

	const allowedReferences = new Set<string>()
	for (const option of options) {
		if (option.disableAutoExpression) allowedReferences.add(stripCompositeOptionPrefix(option.id))
	}

	const getOptionValue = createRestrictedGetOptionValue(
		allowedReferences,
		(optionId) => elementProps[`opt:${optionId}`]?.value
	)

	for (const option of options) {
		const isVisibleFn = parseIsVisibleFn(option)
		if (!isVisibleFn) continue

		try {
			if (!isVisibleFn({}, getOptionValue)) hiddenFields.add(option.id)
		} catch (e) {
			console.error('Failed to check visibility', e)
		}
	}

	return hiddenFields
}

function stripCompositeOptionPrefix(id: string): string {
	return id.startsWith('opt:') ? id.slice(4) : id
}

export function useElementSchemaSections(
	elementProps: Readonly<SomeButtonGraphicsElement>
): ElementSchemaSection[] | undefined {
	const { compositeElementDefinitions } = useContext(RootAppStoreContext)

	return getElementSchemaSections(elementProps, compositeElementDefinitions)
}
