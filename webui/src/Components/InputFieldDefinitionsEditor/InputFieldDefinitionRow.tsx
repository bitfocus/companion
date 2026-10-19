import { faArrowDown, faArrowUp, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useMemo } from 'react'
import type { JsonValue } from 'type-fest'
import type { ExpressionOrValue, SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { OptionsInputField } from '~/Controls/OptionsInputField.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { Accordion } from '../Accordion.js'
import { Button } from '../Button.js'
import { Form } from '../Form.js'
import type { InputFieldDefinitionsService } from './InputFieldDefinitionsEditor.js'
import {
	changeInputFieldType,
	commonAdvancedProperties,
	getInputFieldTypeSpec,
	getPropertyEditorValue,
	InputFieldTypeSpecs,
	isInputFieldIdValid,
	setInputFieldLabel,
	setPropertyEditorValue,
	type InputFieldPropertySpec,
} from './InputFieldTypes.js'

const typeField: SomeCompanionInputField = {
	type: 'dropdown',
	id: 'type',
	label: 'Type',
	default: 'textinput',
	choices: InputFieldTypeSpecs.map((spec) => ({ id: spec.type, label: spec.label })),
}
const labelField: SomeCompanionInputField = { type: 'textinput', id: 'label', label: 'Label', default: '' }

interface InputFieldDefinitionRowProps {
	field: SomeCompanionInputField
	index: number
	count: number
	allIds: ReadonlySet<string>
	service: InputFieldDefinitionsService
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
}

export const InputFieldDefinitionRow = observer(function InputFieldDefinitionRow({
	field,
	index,
	count,
	allIds,
	service,
	readonly,
	localVariablesStore,
}: InputFieldDefinitionRowProps): React.JSX.Element {
	const spec = getInputFieldTypeSpec(field.type)

	const otherIds = useMemo(() => {
		const ids = new Set(allIds)
		ids.delete(field.id)
		return ids
	}, [allIds, field.id])

	const idField = useMemo(
		(): SomeCompanionInputField => ({
			type: 'textinput',
			id: 'id',
			label: 'Id',
			default: '',
			description: `Use as $(options:${field.id})`,
			regex: '/^[\\w-]+$/',
		}),
		[field.id]
	)

	const update = useCallback(
		(newField: SomeCompanionInputField) => service.updateField(field.id, newField),
		[service, field]
	)

	const setHeaderValue = useCallback(
		(key: string, value: ExpressionOrValue<JsonValue | undefined>) => {
			const newValue = value.value
			switch (key) {
				case 'label':
					update(setInputFieldLabel(field, stringifyVariableValue(newValue) ?? '', otherIds))
					break
				case 'id': {
					const id = stringifyVariableValue(newValue) ?? ''
					// Ignore ids which can't be used, so that the field keeps a usable id
					if (isInputFieldIdValid(id, otherIds)) update({ ...field, id })
					break
				}
				case 'type':
					update(changeInputFieldType(field, newValue as SomeCompanionInputField['type']))
					break
			}
		},
		[update, field, otherIds]
	)

	const defaultField = useMemo((): SomeCompanionInputField | null => {
		if (!spec?.hasDefault) return null
		// Show the field itself, so that the default value is edited the same way as the value will be
		return {
			...field,
			id: 'default',
			label: 'Default value',
			description: undefined,
			tooltip: undefined,
			isVisibleUi: undefined,
		}
	}, [spec, field])

	const setDefaultValue = useCallback(
		(_key: string, value: ExpressionOrValue<JsonValue | undefined>) =>
			update({ ...field, default: value.value } as SomeCompanionInputField),
		[update, field]
	)

	const advanced = [...(spec?.advanced ?? []), ...commonAdvancedProperties]

	return (
		<div className="input-field-definition">
			<div className="input-field-definition-header">
				<span className="input-field-definition-title">{field.label || field.id}</span>
				{!readonly && (
					<>
						<Button
							color="secondary"
							variant="ghost"
							size="sm"
							onClick={() => service.moveField(field.id, -1)}
							disabled={index === 0}
							title="Move up"
						>
							<FontAwesomeIcon icon={faArrowUp} />
						</Button>
						<Button
							color="secondary"
							variant="ghost"
							size="sm"
							onClick={() => service.moveField(field.id, 1)}
							disabled={index === count - 1}
							title="Move down"
						>
							<FontAwesomeIcon icon={faArrowDown} />
						</Button>
						<Button
							color="danger"
							variant="ghost"
							size="sm"
							onClick={() => service.removeField(field.id)}
							title="Remove input"
						>
							<FontAwesomeIcon icon={faTrash} />
						</Button>
					</>
				)}
			</div>

			<Form row className="sm:gap-2" onSubmit={PreventDefaultHandler}>
				<PlainOptionsInputField option={labelField} value={field.label} setValue={setHeaderValue} readonly={readonly} />
				<PlainOptionsInputField option={idField} value={field.id} setValue={setHeaderValue} readonly={readonly} />
				<PlainOptionsInputField option={typeField} value={field.type} setValue={setHeaderValue} readonly={readonly} />

				{spec?.properties.map((property) => (
					<PropertyInputField
						key={property.field.id}
						field={field}
						property={property}
						update={update}
						readonly={readonly}
					/>
				))}

				{defaultField && (
					<OptionsInputField
						allowInternalFields={true}
						isLocatedInGrid={false}
						entityType={null}
						option={defaultField}
						value={{ isExpression: false, value: 'default' in field ? field.default : undefined }}
						setValue={setDefaultValue}
						visibility={true}
						readonly={readonly}
						localVariablesStore={localVariablesStore}
						fieldSupportsExpression={false}
					/>
				)}
			</Form>

			<Accordion.Root>
				<Accordion.Item>
					<Accordion.Header>
						<Accordion.Trigger>Advanced</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>
						<Form row className="sm:gap-2 pt-2" onSubmit={PreventDefaultHandler}>
							{advanced.map((property) => (
								<PropertyInputField
									key={property.field.id}
									field={field}
									property={property}
									update={update}
									readonly={readonly}
								/>
							))}
						</Form>
					</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		</div>
	)
})

interface PropertyInputFieldProps {
	field: SomeCompanionInputField
	property: InputFieldPropertySpec
	update: (field: SomeCompanionInputField) => void
	readonly: boolean
}

const PropertyInputField = observer(function PropertyInputField({
	field,
	property,
	update,
	readonly,
}: PropertyInputFieldProps): React.JSX.Element {
	const setValue = useCallback(
		(_key: string, value: ExpressionOrValue<JsonValue | undefined>) =>
			update(setPropertyEditorValue(field, property, value.value)),
		[update, field, property]
	)

	return (
		<PlainOptionsInputField
			option={property.field}
			value={getPropertyEditorValue(field, property)}
			setValue={setValue}
			readonly={readonly}
		/>
	)
})

interface PlainOptionsInputFieldProps {
	option: SomeCompanionInputField
	value: JsonValue | undefined
	setValue: (key: string, value: ExpressionOrValue<JsonValue | undefined>) => void
	readonly: boolean
}

/** A field for a property of a definition, whose value can never be an expression */
function PlainOptionsInputField({ option, value, setValue, readonly }: PlainOptionsInputFieldProps): React.JSX.Element {
	return (
		<OptionsInputField
			allowInternalFields={true}
			isLocatedInGrid={false}
			entityType={null}
			option={option}
			value={
				option.type === 'expression'
					? { isExpression: true, value: stringifyVariableValue(value) ?? '' }
					: { isExpression: false, value }
			}
			setValue={setValue}
			visibility={true}
			readonly={readonly}
			localVariablesStore={null}
			fieldSupportsExpression={false}
		/>
	)
}
