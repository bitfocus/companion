import { useContext } from 'react'
import { elementSchemas, type ElementSchemaSection } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
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
		if (compositeDefinition)
			return [...schema, { id: 'properties', label: 'Properties', fields: compositeDefinition.options }]
	}

	return schema
}

export function useElementSchemaSections(
	elementProps: Readonly<SomeButtonGraphicsElement>
): ElementSchemaSection[] | undefined {
	const { compositeElementDefinitions } = useContext(RootAppStoreContext)

	return getElementSchemaSections(elementProps, compositeElementDefinitions)
}
