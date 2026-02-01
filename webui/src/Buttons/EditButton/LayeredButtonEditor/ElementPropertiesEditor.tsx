import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import React, { useContext } from 'react'
import { observer } from 'mobx-react-lite'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { CForm } from '@coreui/react'
import { ElementCommonProperties } from './ElementCommonProperties.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { elementSchemas, elementSimpleModeFields } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import { OptionsInputControl, getInputFeatures } from '~/Controls/OptionsInputField.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { FormPropertyField } from './ElementPropertiesUtil.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { ElementPropertiesProvider, type IsPropertyOverridden } from './ElementPropertiesContext.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { JsonValue } from 'type-fest'

interface ElementPropertiesEditorProps {
	controlId: string
	elementProps: SomeButtonGraphicsElement
	localVariablesStore: LocalVariablesStore
	isPropertyOverridden: IsPropertyOverridden
	simpleMode: boolean
}

export const ElementPropertiesEditor = observer(function ElementPropertiesEditor({
	controlId,
	elementProps,
	localVariablesStore,
	isPropertyOverridden,
	simpleMode,
}: ElementPropertiesEditorProps) {
	return (
		<ElementPropertiesProvider
			controlId={controlId}
			localVariablesStore={localVariablesStore}
			isPropertyOverridden={isPropertyOverridden}
		>
			<CForm className="row g-2" onSubmit={PreventDefaultHandler}>
				<ElementCommonProperties elementProps={elementProps} simpleMode={simpleMode} />

				<ElementPropertiesEditorSchemaVersion elementProps={elementProps} simpleMode={simpleMode} />
			</CForm>
		</ElementPropertiesProvider>
	)
})

const ElementPropertiesEditorSchemaVersion = observer(function ElementPropertiesEditorSchemaVersion({
	elementProps,
	simpleMode,
}: {
	elementProps: SomeButtonGraphicsElement
	simpleMode: boolean
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

	const simpleModeFields: string[] | undefined =
		simpleMode && elementProps.type in elementSimpleModeFields
			? elementSimpleModeFields[elementProps.type as keyof typeof elementSimpleModeFields]
			: undefined

	if (!schema) {
		return <div>No schema found for element type: {elementProps.type}</div>
	}

	return (
		<>
			{schema.map((field) => {
				// In simple mode, skip fields not in the allowlist
				if (simpleModeFields && !simpleModeFields.includes(field.id)) return null

				return (
					<SchemaFieldWrapper
						key={field.id}
						field={field}
						elementProps={elementProps}
						localVariablesStore={localVariablesStore}
					/>
				)
			})}
			{simpleModeFields ? (
				<div className="text-center text-muted mt-3" style={{ fontSize: '0.875rem' }}>
					Some fields are hidden in simple mode
				</div>
			) : null}
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
					setValue={(value: JsonValue | undefined) => setValueFromForm(value)}
					readonly={false}
					localVariablesStore={localVariablesStore}
					features={features}
				/>
			)}
		</FormPropertyField>
	)
})
