import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { Fragment, useCallback, useContext } from 'react'
import type { JsonValue } from 'type-fest'
import { elementSchemas, elementSimpleModeFields } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type {
	ExpressionOrValue,
	InternalInputFieldList,
	SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { Accordion } from '~/Components/Accordion.js'
import { Button } from '~/Components/Button.js'
import { Form } from '~/Components/Form.js'
import { getRowId, ListRowControls, normaliseCell, useListField } from '~/Components/ListInputField.js'
import { PropertyFieldRow } from '~/Components/PropertyFieldRow.js'
import { getInputFeatures } from '~/Controls/InputFeatures.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { OptionsInputControl } from '~/Controls/OptionsInputControl.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ElementCommonProperties } from './ElementCommonProperties.js'
import { ElementPropertiesProvider, type IsPropertyOverridden } from './ElementPropertiesContext.js'
import { FormPropertyField } from './ElementPropertiesUtil.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'

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
			<Form className="row g-2" onSubmit={PreventDefaultHandler}>
				<ElementCommonProperties elementProps={elementProps} simpleMode={simpleMode} />

				<ElementPropertiesEditorSchemaVersion elementProps={elementProps} simpleMode={simpleMode} />
			</Form>
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

	let schema = elementSchemas[elementProps.type]

	// If this is a composite element, get the full schema
	if (elementProps.type === 'composite' && elementProps.connectionId && elementProps.elementId) {
		const compositeDefinition = compositeElementDefinitions.getDefinition(
			elementProps.connectionId,
			elementProps.elementId
		)

		if (compositeDefinition) {
			// Combine common element fields with the custom schema from the composite definition
			schema = [...schema, { id: 'properties', label: 'Properties', fields: compositeDefinition.options }]
		}
	}

	const simpleModeFieldIds: readonly string[] | undefined =
		simpleMode && elementProps.type in elementSimpleModeFields
			? elementSimpleModeFields[elementProps.type as keyof typeof elementSimpleModeFields]
			: undefined

	if (!schema) {
		return <div>No schema found for element type: {elementProps.type}</div>
	}

	// Render flat for simple mode, or elements with only one section
	if (simpleModeFieldIds || schema.length === 1) {
		const flatFields = schema.flatMap((s) => s.fields)

		return (
			<>
				{flatFields.map((field) => {
					if (simpleModeFieldIds && !simpleModeFieldIds.includes(field.id)) return null
					return (
						<SchemaFieldWrapper
							key={field.id}
							field={field}
							elementProps={elementProps}
							localVariablesStore={localVariablesStore}
						/>
					)
				})}

				{simpleModeFieldIds ? (
					<div className="text-center text-muted mt-3" style={{ fontSize: '0.875rem' }}>
						Some fields are hidden in simple mode
					</div>
				) : null}
			</>
		)
	}

	const defaultOpenSectionIds = schema.filter((s) => s.fields.length > 0).map((s) => s.id)

	return (
		<>
			<Accordion.Root defaultValue={defaultOpenSectionIds} multiple>
				{schema.map((section) => {
					if (section.fields.length === 0) return null
					return (
						<Accordion.Item key={section.id} value={section.id}>
							<Accordion.Header>
								<Accordion.Trigger className="fw-bold">{section.label}</Accordion.Trigger>
							</Accordion.Header>
							<Accordion.Panel>
								<div className="row g-2 p-2">
									{section.fields.map((field) => (
										<SchemaFieldWrapper
											key={field.id}
											field={field}
											elementProps={elementProps}
											localVariablesStore={localVariablesStore}
										/>
									))}
								</div>
							</Accordion.Panel>
						</Accordion.Item>
					)
				})}
			</Accordion.Root>
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
	if (field.type === 'internal:list') {
		// This wants to be flattened to make it 'transparent', so bypasses the usual rendering flow
		return (
			<ListSchemaFieldWrapper field={field} elementProps={elementProps} localVariablesStore={localVariablesStore} />
		)
	}

	const features = getInputFeatures(field)

	return (
		<FormPropertyField
			elementProps={elementProps}
			property={field.id}
			label={field.label}
			tooltip={field.tooltip}
			description={field.description}
			expressionDescription={field.expressionDescription}
			features={features}
			disableAutoExpression={field.disableAutoExpression}
		>
			{(elementProp, setValueFromForm, inputId) => (
				<OptionsInputControl
					inputId={inputId}
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

const LIST_HEADER_VALUE = { isExpression: false as const, value: undefined }
const noop = () => {}

const ListSchemaFieldWrapper = observer(function ListSchemaFieldWrapper({
	field,
	elementProps,
	localVariablesStore,
}: {
	field: InternalInputFieldList
	elementProps: SomeButtonGraphicsElement
	localVariablesStore: LocalVariablesStore
}) {
	const { controlId } = useElementPropertiesContext()
	const updateOptionMutation = useMutationExt(trpc.controls.styles.updateOption.mutationOptions())

	const rawValue = (elementProps as unknown as Record<string, unknown>)[field.id] as
		ExpressionOrValue<JsonValue | undefined> | undefined

	const setListValue = useCallback(
		(newRows: Record<string, ExpressionOrValue<JsonValue>>[]) => {
			updateOptionMutation
				.mutateAsync({
					controlId,
					elementId: elementProps.id,
					key: field.id,
					value: { isExpression: false, value: newRows as unknown as JsonValue },
				})
				.catch((e) => console.error('Failed to update element', e))
		},
		[updateOptionMutation, controlId, elementProps.id, field.id]
	)

	const listValue = rawValue?.isExpression
		? undefined
		: (rawValue?.value as Record<string, ExpressionOrValue<JsonValue>>[] | undefined)

	const { rows, addRow, removeRow, moveRow, updateCell } = useListField(field, listValue, setListValue)

	const atMinimum = field.minItems !== undefined && rows.length <= field.minItems

	return (
		<>
			<PropertyFieldRow
				label={field.label}
				tooltip={field.tooltip}
				features={getInputFeatures(field)}
				value={LIST_HEADER_VALUE}
				setValue={noop}
				disableAutoExpression={true}
				localVariablesStore={localVariablesStore}
				entityType={null}
				isLocatedInGrid={false}
				disabled={false}
			>
				{() => (
					<>
						<Button color="primary" size="sm" onClick={addRow}>
							<FontAwesomeIcon icon={faPlus} className="me-1" />
							{field.addLabel ?? 'Add item'}
						</Button>
						{field.description && <div className="form-text">{field.description}</div>}
					</>
				)}
			</PropertyFieldRow>
			{rows.map((row, rowIndex) => (
				<Fragment key={getRowId(row, rowIndex)}>
					<ListRowControls
						rowIndex={rowIndex}
						rowCount={rows.length}
						atMinimum={atMinimum}
						moveRow={moveRow}
						removeRow={removeRow}
					/>
					{field.fields.map((cellField) => {
						const cell = normaliseCell((row as Record<string, unknown>)[cellField.id] as never)
						const setCell = (newCell: ExpressionOrValue<JsonValue | undefined>) =>
							updateCell(rowIndex, cellField.id, newCell)
						return (
							<PropertyFieldRow
								key={cellField.id}
								label={cellField.label}
								tooltip={cellField.tooltip}
								features={getInputFeatures(cellField)}
								value={cell}
								setValue={setCell}
								disableAutoExpression={!!cellField.disableAutoExpression}
								localVariablesStore={localVariablesStore}
								entityType={null}
								isLocatedInGrid={false}
								disabled={false}
								labelClassName="ps-2"
							>
								{(fieldValue, setInnerValue, inputId) => (
									<OptionsInputControl
										inputId={inputId}
										allowInternalFields={true}
										isLocatedInGrid={false}
										entityType={EntityModelType.Feedback}
										option={cellField}
										value={fieldValue.value}
										setValue={setInnerValue}
										readonly={false}
										localVariablesStore={localVariablesStore}
										features={getInputFeatures(cellField)}
									/>
								)}
							</PropertyFieldRow>
						)
					})}
				</Fragment>
			))}
		</>
	)
})
