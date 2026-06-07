import { faArrowDown, faArrowUp, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { Fragment, useCallback, useId, useMemo } from 'react'
import type { JsonValue } from 'type-fest'
import type { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import {
	isExpressionOrValue,
	type ExpressionOrValue,
	type InternalInputFieldList,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { Button } from './Button.js'
import { ColorInputField } from './ColorInputField.js'
import { FieldOrExpression } from './FieldOrExpression.js'
import { FormLabel } from './Form.js'
import { Grid } from './Grid.js'
import { InlineHelpIcon } from './InlineHelp.js'
import { NumberInputField } from './NumberInputField.js'
import { TextInputFieldSimple } from './TextInputField.js'

function fieldDefault(field: SomeCompanionInputField): JsonValue {
	if ('default' in field && field.default !== undefined) return field.default
	return null
}

function newRow(fields: SomeCompanionInputField[]): Record<string, ExpressionOrValue<JsonValue>> {
	const row: Record<string, ExpressionOrValue<JsonValue>> = {}
	for (const field of fields) row[field.id] = { isExpression: false, value: fieldDefault(field) }
	return row
}

function normaliseCell(raw: JsonValue | undefined): ExpressionOrValue<JsonValue | undefined> {
	if (isExpressionOrValue(raw)) return raw
	return { isExpression: false, value: raw }
}

interface ListCellProps {
	field: SomeCompanionInputField
	value: JsonValue | undefined
	setValue: (v: JsonValue) => void
	disabled?: boolean
	inputId: string
}

function ListCell({ field, value, setValue, disabled, inputId }: ListCellProps): React.JSX.Element {
	switch (field.type) {
		case 'number':
			return (
				<NumberInputField
					id={inputId}
					value={value as number | undefined}
					setValue={setValue}
					min={field.min}
					max={field.max}
					step={field.step}
					disabled={disabled}
				/>
			)
		case 'colorpicker':
			return (
				<ColorInputField<'number'>
					id={inputId}
					value={(value as number | undefined) ?? 0}
					setValue={setValue}
					enableAlpha={field.enableAlpha ?? false}
					returnType={field.returnType ?? 'number'}
					disabled={disabled}
				/>
			)
		case 'textinput':
			return (
				<TextInputFieldSimple
					id={inputId}
					value={(value as string | undefined) ?? ''}
					setValue={setValue}
					disabled={disabled}
				/>
			)
		default:
			return <span className="text-muted">Unsupported field type</span>
	}
}

export interface ListInputFieldProps {
	definition: InternalInputFieldList
	value: Record<string, ExpressionOrValue<JsonValue>>[] | undefined
	setValue: (rows: Record<string, ExpressionOrValue<JsonValue>>[]) => void
	disabled?: boolean
	localVariablesStore: LocalVariablesStore | null
	entityType: EntityModelType | null
	isLocatedInGrid: boolean
	fieldSupportsExpression: boolean
	visibility?: boolean
}

export const ListInputField = observer(function ListInputField({
	definition,
	value,
	setValue,
	disabled,
	localVariablesStore,
	entityType,
	isLocatedInGrid,
	fieldSupportsExpression,
	visibility = true,
}: ListInputFieldProps): React.JSX.Element {
	const baseId = useId()
	const rows = useMemo(() => value ?? [], [value])

	const addRow = useCallback(() => {
		setValue([...rows, newRow(definition.fields)])
	}, [rows, definition.fields, setValue])

	const removeRow = useCallback(
		(rowIndex: number) => {
			setValue(rows.filter((_, i) => i !== rowIndex))
		},
		[rows, setValue]
	)

	const moveRow = useCallback(
		(rowIndex: number, direction: -1 | 1) => {
			const next = rowIndex + direction
			if (next < 0 || next >= rows.length) return
			const updated = [...rows]
			;[updated[rowIndex], updated[next]] = [updated[next], updated[rowIndex]]
			setValue(updated)
		},
		[rows, setValue]
	)

	const updateCell = useCallback(
		(rowIndex: number, fieldId: string, cellValue: ExpressionOrValue<JsonValue | undefined>) => {
			setValue(
				rows.map((row, i) => (i === rowIndex ? { ...row, [fieldId]: cellValue as ExpressionOrValue<JsonValue> } : row))
			)
		},
		[rows, setValue]
	)

	const hidden = !visibility
	const atMinimum = definition.minItems !== undefined && rows.length <= definition.minItems

	return (
		<>
			<FormLabel
				htmlFor={undefined}
				className={classNames('col-sm-4 col-form-label col-form-label-sm', { displayNone: hidden })}
			>
				{definition.label}
				{definition.tooltip && <InlineHelpIcon className="ms-1">{definition.tooltip}</InlineHelpIcon>}
			</FormLabel>
			<Grid.Col sm={8} className={classNames({ displayNone: hidden })}>
				<Button color="primary" size="sm" onClick={addRow} disabled={disabled}>
					<FontAwesomeIcon icon={faPlus} className="me-1" />
					{definition.addLabel ?? 'Add item'}
				</Button>
				{definition.description && <div className="form-text">{definition.description}</div>}
			</Grid.Col>

			{rows.map((row, rowIndex) => (
				<Fragment key={rowIndex}>
					<div className={classNames('col-sm-4 col-form-label col-form-label-sm text-muted', { displayNone: hidden })}>
						Item {rowIndex + 1}
					</div>
					<Grid.Col sm={8} className={classNames('d-flex gap-1', { displayNone: hidden })}>
						<Button
							color="secondary"
							variant="outline"
							size="sm"
							onClick={() => moveRow(rowIndex, -1)}
							disabled={disabled || rowIndex === 0}
							title="Move up"
						>
							<FontAwesomeIcon icon={faArrowUp} />
						</Button>
						<Button
							color="secondary"
							variant="outline"
							size="sm"
							onClick={() => moveRow(rowIndex, 1)}
							disabled={disabled || rowIndex === rows.length - 1}
							title="Move down"
						>
							<FontAwesomeIcon icon={faArrowDown} />
						</Button>
						<Button
							color="danger"
							size="sm"
							onClick={() => removeRow(rowIndex)}
							disabled={disabled || atMinimum}
							title="Remove item"
						>
							<FontAwesomeIcon icon={faTrash} />
						</Button>
					</Grid.Col>

					{definition.fields.map((field) => {
						const cellRaw = row[field.id]
						const cell = normaliseCell(cellRaw)
						const inputId = `${baseId}-${rowIndex}-${field.id}`
						const canExpression = fieldSupportsExpression && !field.disableAutoExpression

						const setCell = (newCell: ExpressionOrValue<JsonValue | undefined>) =>
							updateCell(rowIndex, field.id, newCell)
						const setCellValue = (v: JsonValue) => setCell({ isExpression: false, value: v })

						const input = (
							<ListCell
								field={field}
								value={cell.isExpression ? undefined : cell.value}
								setValue={setCellValue}
								disabled={disabled}
								inputId={inputId}
							/>
						)

						return (
							<Fragment key={field.id}>
								<FormLabel
									htmlFor={inputId}
									className={classNames('col-sm-4 col-form-label col-form-label-sm', { displayNone: hidden })}
									style={{ paddingInlineStart: '1.5rem' }}
								>
									{field.label}
								</FormLabel>
								<Grid.Col sm={8} className={classNames({ displayNone: hidden })}>
									{canExpression ? (
										<FieldOrExpression
											inputId={inputId}
											value={cell}
											setValue={setCell}
											localVariablesStore={localVariablesStore}
											entityType={entityType}
											isLocatedInGrid={isLocatedInGrid}
											disabled={!!disabled}
										>
											{input}
										</FieldOrExpression>
									) : (
										input
									)}
								</Grid.Col>
							</Fragment>
						)
					})}
				</Fragment>
			))}
		</>
	)
})
