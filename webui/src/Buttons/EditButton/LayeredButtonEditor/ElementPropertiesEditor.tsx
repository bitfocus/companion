import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import React, { useContext } from 'react'
import { observer } from 'mobx-react-lite'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { CForm } from '@coreui/react'
import { ElementCommonProperties } from './ElementCommonProperties.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { elementSchemas } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import { OptionsInputControl, getInputFeatures } from '~/Controls/OptionsInputField.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { FormPropertyField } from './ElementPropertiesUtil.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { ElementPropertiesProvider, type IsPropertyOverridden } from './ElementPropertiesContext.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface ElementPropertiesEditorProps {
	controlId: string
	elementProps: SomeButtonGraphicsElement
	localVariablesStore: LocalVariablesStore
	isPropertyOverridden: IsPropertyOverridden
}

export const ElementPropertiesEditor = observer(function ElementPropertiesEditor({
	controlId,
	elementProps,
	localVariablesStore,
	isPropertyOverridden,
}: ElementPropertiesEditorProps) {
	return (
		<ElementPropertiesProvider
			controlId={controlId}
			localVariablesStore={localVariablesStore}
			isPropertyOverridden={isPropertyOverridden}
		>
			<CForm className="row g-2" onSubmit={PreventDefaultHandler}>
				<ElementCommonProperties elementProps={elementProps} />

				<ElementPropertiesEditorSchemaVersion elementProps={elementProps} />
			</CForm>
		</ElementPropertiesProvider>
	)
})

const ElementPropertiesEditorSchemaVersion = observer(function ElementPropertiesEditorSchemaVersion({
	elementProps,
}: {
	elementProps: SomeButtonGraphicsElement
}) {
	const { localVariablesStore } = useElementPropertiesContext()
	const { compositeElementDefinitions } = useContext(RootAppStoreContext)

	let schema: SomeCompanionInputField[] = elementSchemas[elementProps.type]

	// If this is a composite element, get the full schema
	if (elementProps.type === 'composite' && elementProps.connectionId && elementProps.elementId) {
		const compositeDefinition = compositeElementDefinitions.getDefinition(
			elementProps.connectionId,
			elementProps.elementId
		)

		if (compositeDefinition) {
			// Combine common element fields with the custom schema from the composite definition
			schema = [...schema, ...compositeDefinition.options]
		}
	}

	if (!schema) {
		return <div>No schema found for element type: {elementProps.type}</div>
	}

	return (
		<>
			{schema.map((field) => (
				<SchemaFieldWrapper
					key={field.id}
					field={field}
					elementProps={elementProps}
					localVariablesStore={localVariablesStore}
				/>
			))}
		</>
	)
})

// Wrapper component to make schema fields work with FormPropertyField-like rendering
const SchemaFieldWrapper = observer(function SchemaFieldWrapper({
	field,
	elementProps,
	localVariablesStore,
}: {
	field: SomeCompanionInputField
	elementProps: SomeButtonGraphicsElement
	localVariablesStore: LocalVariablesStore
}) {
	const features = getInputFeatures(field)

	return (
		<FormPropertyField elementProps={elementProps} property={field.id} label={field.label} features={features}>
			{(elementProp, setValueFromForm) => (
				<OptionsInputControl
					allowInternalFields={true}
					isLocatedInGrid={false}
					entityType={EntityModelType.Feedback}
					option={field}
					value={elementProp.value}
					setValue={(_key: string, value: any) => setValueFromForm(value)}
					readonly={false}
					localVariablesStore={localVariablesStore}
					features={features}
				/>
			)}
		</FormPropertyField>
	)
})
