import { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import React from 'react'
import { observer } from 'mobx-react-lite'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { ImageElementPropertiesEditor } from './ImageElementPropertiesEditor.js'
import { CForm } from '@coreui/react'
import { ElementCommonProperties } from './ElementCommonProperties.js'
import { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { ElementPropertiesProvider } from './ElementPropertiesContext.js'
import { elementSchemas } from './ElementPropertiesSchemas.js'
import { OptionsInputControl, getInputFeatures } from '~/Controls/OptionsInputField.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { FormPropertyField } from './ElementPropertiesUtil.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'

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

				{/* Schema-based version for comparison */}
				<ElementPropertiesEditorSchemaVersion elementProps={elementProps} />

				{/* Original version - keeping for comparison */}
				<hr style={{ margin: '20px 0', borderColor: '#ff6b6b' }} />
				<div style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc3545', marginBottom: '10px' }}>
					Original Implementation:
				</div>
				<ElementPropertiesEditorInner elementProps={elementProps} />
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
			<div style={{ fontSize: '14px', fontWeight: 'bold', color: '#28a745', marginBottom: '10px' }}>
				Schema-based Implementation:
			</div>
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
	field: any
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

interface ElementPropertiesEditorInnerProps {
	elementProps: SomeButtonGraphicsElement
}

const ElementPropertiesEditorInner = observer(function ElementPropertiesEditorInner({
	elementProps,
}: ElementPropertiesEditorInnerProps) {
	switch (elementProps.type) {
		case 'image':
			return <ImageElementPropertiesEditor elementProps={elementProps} />

		default:
			return null
	}
})
