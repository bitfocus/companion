import { useSortable } from '@dnd-kit/react/sortable'
import { faChevronDown, faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useId, useMemo, useState } from 'react'
import type { JsonValue } from 'type-fest'
import {
	toCompanionInputField,
	type AuthorableInputField,
	type ExpressionOrValue,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { OptionsInputField } from '~/Controls/OptionsInputField.js'
import type { PanelCollapseHelperLite } from '~/Helpers/CollapseHelper.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { Button } from '../Button.js'
import { Form, FormLabel } from '../Form.js'
import { Grid } from '../Grid.js'
import { TextInputFieldSimple } from '../TextInputField.js'
import type { InputFieldDefinitionsService } from './InputFieldDefinitionsEditor.js'
import {
	commonAdvancedProperties,
	getInputFieldTypeSpec,
	getPropertyEditorValue,
	isInputFieldIdValid,
	setInputFieldLabel,
	setPropertyEditorValue,
	type InputFieldPropertySpec,
} from './InputFieldTypes.js'

interface InputFieldDefinitionRowProps {
	field: AuthorableInputField
	index: number
	dragId: string
	allIds: ReadonlySet<string>
	service: InputFieldDefinitionsService
	/** Remove the field, after asking for confirmation */
	removeField: (field: AuthorableInputField) => void
	panelCollapseHelper: PanelCollapseHelperLite
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
}

/**
 * An input field in the list, laid out like an action or event of a control
 */
export const InputFieldDefinitionRow = observer(function InputFieldDefinitionRow({
	field,
	index,
	dragId,
	allIds,
	service,
	removeField,
	panelCollapseHelper,
	readonly,
	localVariablesStore,
}: InputFieldDefinitionRowProps): React.JSX.Element {
	const spec = getInputFieldTypeSpec(field.type)

	// The index is the id to sort by, as the id of a field changes while its label is being typed
	const { ref, handleRef } = useSortable({
		id: `${dragId}_${index}`,
		index,
		type: dragId,
		accept: dragId,
		transition: null,
		disabled: readonly,
	})

	const otherIds = useMemo(() => {
		const ids = new Set(allIds)
		ids.delete(field.id)
		return ids
	}, [allIds, field.id])

	const update = useCallback(
		(newField: AuthorableInputField) => service.updateField(field.id, newField),
		[service, field]
	)

	const setLabel = useCallback(
		(label: string) => update(setInputFieldLabel(field, label, otherIds)),
		[update, field, otherIds]
	)
	const checkIdValid = useCallback((id: string) => isInputFieldIdValid(id, otherIds), [otherIds])
	const setId = useCallback(
		(id: string) => {
			// Ignore ids which can't be used, so that the field keeps a usable id
			if (checkIdValid(id)) update({ ...field, id })
		},
		[update, field, checkIdValid]
	)

	const defaultField = useMemo((): SomeCompanionInputField | null => {
		if (!spec?.hasDefault) return null
		// Show the field itself, so that the default value is edited the same way as the value will be
		return {
			...toCompanionInputField(field),
			id: 'default',
			label: 'Default value',
			description: undefined,
			tooltip: undefined,
		}
	}, [spec, field])

	const setDefaultValue = useCallback(
		(_key: string, value: ExpressionOrValue<JsonValue | undefined>) =>
			update({ ...field, default: value.value } as AuthorableInputField),
		[update, field]
	)

	const advanced = [...(spec?.advanced ?? []), ...commonAdvancedProperties]
	const [showAdvanced, setShowAdvanced] = useState(false)

	const isCollapsed = panelCollapseHelper.isPanelCollapsed(field.id)
	const toggleCollapsed = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(field.id, !isCollapsed),
		[panelCollapseHelper, field.id, isCollapsed]
	)

	return (
		<div ref={ref} className="entity-row">
			<div ref={handleRef} className="entity-row-reorder">
				<FontAwesomeIcon icon={faSort} />
			</div>
			<div className="entity-row-content">
				<div className="editor-grid-header flex items-center justify-between gap-3">
					<div
						className="flex items-center gap-2.5 flex-1 min-w-0 select-none py-0.5 cursor-pointer"
						onClick={toggleCollapsed}
					>
						<span className="px-1.5 py-0.5 rounded text-3xs font-semibold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20 shrink-0">
							{spec?.label ?? field.type}
						</span>
						<span className="font-semibold text-xs text-body leading-tight truncate" title={field.label || field.id}>
							{field.label || field.id}
						</span>
					</div>

					<div className="cell-controls flex items-center gap-0.5 shrink-0">
						{!readonly && (
							<Button
								size="sm"
								className="p-1.5"
								onClick={() => removeField(field)}
								title="Remove input"
								variant="ghost"
								color="danger"
							>
								<FontAwesomeIcon icon={faTrash} className="text-xs" />
							</Button>
						)}
						<Button
							variant="ghost"
							size="sm"
							className="p-1.5"
							onClick={toggleCollapsed}
							title={isCollapsed ? 'Expand input' : 'Collapse input'}
						>
							<FontAwesomeIcon
								icon={faChevronDown}
								className={`text-xs transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
							/>
						</Button>
					</div>
				</div>

				{!isCollapsed && (
					<div className="editor-grid">
						<Form row className="sm:gap-2" onSubmit={PreventDefaultHandler}>
							{/* The id follows the label, so how to use it is shown with the label */}
							<DefinitionTextField
								label="Label"
								description={`Use as $(options:${field.id})`}
								value={field.label}
								setValue={setLabel}
								checkValid={null}
								readonly={readonly}
							/>

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

						{/* A heading for the extra options, which stay below it when shown */}
						<Button
							variant="ghost"
							size="sm"
							className="mt-1 text-3xs"
							onClick={() => setShowAdvanced(!showAdvanced)}
							title={showAdvanced ? 'Hide more options' : 'Show more options'}
						>
							<FontAwesomeIcon
								icon={faChevronDown}
								className={`text-2xs me-1 transition-transform duration-200 ${showAdvanced ? 'rotate-0' : '-rotate-90'}`}
							/>
							More options
						</Button>

						{showAdvanced && (
							<Form row className="sm:gap-2" onSubmit={PreventDefaultHandler}>
								<DefinitionTextField
									label="Id"
									description={null}
									value={field.id}
									setValue={setId}
									checkValid={checkIdValid}
									readonly={readonly}
								/>
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
						)}
					</div>
				)}
			</div>
		</div>
	)
})

interface PropertyInputFieldProps {
	field: AuthorableInputField
	property: InputFieldPropertySpec
	update: (field: AuthorableInputField) => void
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

interface DefinitionTextFieldProps {
	label: string
	description: string | null
	value: string
	setValue: (value: string) => void
	checkValid: ((value: string) => boolean) | null
	readonly: boolean
}

/** A text field for a property which every field has, laid out like the fields for the other properties */
function DefinitionTextField({
	label,
	description,
	value,
	setValue,
	checkValid,
	readonly,
}: DefinitionTextFieldProps): React.JSX.Element {
	const inputId = useId()

	return (
		<>
			<FormLabel htmlFor={inputId} sm={4} column="sm">
				{label}
			</FormLabel>
			<Grid.Col sm={8}>
				<TextInputFieldSimple
					id={inputId}
					value={value}
					setValue={setValue}
					checkValid={checkValid ?? undefined}
					disabled={readonly}
				/>
				{description && <div className="form-text">{description}</div>}
			</Grid.Col>
		</>
	)
}
