import { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import React from 'react'
import { observer } from 'mobx-react-lite'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { CForm } from '@coreui/react'
import { ElementCommonProperties } from './ElementCommonProperties.js'
import { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { ElementPropertiesProvider } from './ElementPropertiesContext.js'
import { elementSchemas } from './ElementPropertiesSchemas.js'
import { OptionsInputControl, getInputFeatures } from '~/Controls/OptionsInputField.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { FormPropertyField } from './ElementPropertiesUtil.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'
import { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'

interface ElementPropertiesEditorProps {
	controlId: string
	elementProps: SomeButtonGraphicsElement
	localVariablesStore: LocalVariablesStore
}

export const ElementPropertiesEditor = observer(function ElementPropertiesEditor({
	controlId,
	elementProps,
	localVariablesStore,
}: ElementPropertiesEditorProps) {
	return (
		<ElementPropertiesProvider controlId={controlId} localVariablesStore={localVariablesStore}>
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

	const schema = elementSchemas[elementProps.type]
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
					connectionId="internal"
					isLocatedInGrid={false}
					entityType={EntityModelType.Action}
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
