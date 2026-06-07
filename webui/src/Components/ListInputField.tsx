import { faArrowDown, faArrowUp, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { nanoid } from 'nanoid'
import { Fragment, useCallback, useId, useMemo, useRef } from 'react'
import type { JsonValue } from 'type-fest'
import type { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import {
	isExpressionOrValue,
	type ExpressionOrValue,
	type InternalInputFieldList,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { ExpressionModeFeatures, getInputFeatures, InputFeatureIcons } from '~/Controls/InputFeatures.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { OptionsInputControl } from '~/Controls/OptionsInputControl.js'
import { Button } from './Button.js'
import { FieldOrExpression } from './FieldOrExpression.js'
import { FormLabel } from './Form.js'
import { Grid } from './Grid.js'
import { InlineHelpIcon } from './InlineHelp.js'

function fieldDefault(field: SomeCompanionInputField): JsonValue {
	if ('default' in field && field.default !== undefined) return field.default
	return null
}

function newRow(fields: SomeCompanionInputField[]): Record<string, ExpressionOrValue<JsonValue>> {
	const row: Record<string, ExpressionOrValue<JsonValue>> = {
		_id: { isExpression: false, value: nanoid() },
	}
	for (const field of fields) row[field.id] = { isExpression: false, value: fieldDefault(field) }
	return row
}

// eslint-disable-next-line react-refresh/only-export-components
export function getRowId(row: Record<string, ExpressionOrValue<JsonValue>>, fallbackIndex: number): string {
	const id = row['_id']
	if (id && isExpressionOrValue(id)) return stringifyVariableValue(id.value) ?? String(fallbackIndex)
	return String(fallbackIndex)
}

// eslint-disable-next-line react-refresh/only-export-components
export function normaliseCell(raw: JsonValue | undefined): ExpressionOrValue<JsonValue | undefined> {
	if (isExpressionOrValue(raw)) return raw
	return { isExpression: false, value: raw }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useListField(
	definition: InternalInputFieldList,
	value: Record<string, ExpressionOrValue<JsonValue>>[] | undefined,
	setValue: (rows: Record<string, ExpressionOrValue<JsonValue>>[]) => void
): {
	rows: Record<string, ExpressionOrValue<JsonValue>>[]
	addRow: () => void
	removeRow: (rowIndex: number) => void
	moveRow: (rowIndex: number, direction: -1 | 1) => void
	updateCell: (rowIndex: number, fieldId: string, cellValue: ExpressionOrValue<JsonValue | undefined>) => void
} {
	const rows = useMemo(() => value ?? [], [value])
	const rowsRef = useRef(rows)
	rowsRef.current = rows

	const addRow = useCallback(() => {
		setValue([...rowsRef.current, newRow(definition.fields)])
	}, [definition.fields, setValue])

	const removeRow = useCallback(
		(rowIndex: number) => {
			setValue(rowsRef.current.filter((_, i) => i !== rowIndex))
		},
		[setValue]
	)

	const moveRow = useCallback(
		(rowIndex: number, direction: -1 | 1) => {
			const next = rowIndex + direction
			if (next < 0 || next >= rowsRef.current.length) return
			const updated = [...rowsRef.current]
			;[updated[rowIndex], updated[next]] = [updated[next], updated[rowIndex]]
			setValue(updated)
		},
		[setValue]
	)

	const updateCell = useCallback(
		(rowIndex: number, fieldId: string, cellValue: ExpressionOrValue<JsonValue | undefined>) => {
			setValue(
				rowsRef.current.map((row, i) =>
					i === rowIndex ? { ...row, [fieldId]: cellValue as ExpressionOrValue<JsonValue> } : row
				)
			)
		},
		[setValue]
	)

	return { rows, addRow, removeRow, moveRow, updateCell }
}

export interface ListRowControlsProps {
	rowIndex: number
	rowCount: number
	atMinimum: boolean
	disabled?: boolean
	hidden?: boolean
	moveRow: (rowIndex: number, direction: -1 | 1) => void
	removeRow: (rowIndex: number) => void
}

export function ListRowControls({
	rowIndex,
	rowCount,
	atMinimum,
	disabled,
	hidden = false,
	moveRow,
	removeRow,
}: ListRowControlsProps): React.ReactNode {
	return (
		<>
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
					disabled={disabled || rowIndex === rowCount - 1}
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
		</>
	)
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
}: ListInputFieldProps) {
	const baseId = useId()
	const { rows, addRow, removeRow, moveRow, updateCell } = useListField(definition, value, setValue)
	const atMinimum = definition.minItems !== undefined && rows.length <= definition.minItems
	const hidden = !visibility

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
				<Fragment key={getRowId(row, rowIndex)}>
					<ListRowControls
						rowIndex={rowIndex}
						rowCount={rows.length}
						atMinimum={atMinimum}
						disabled={disabled}
						hidden={hidden}
						moveRow={moveRow}
						removeRow={removeRow}
					/>

					{definition.fields.map((field) => {
						const cellRaw = row[field.id]
						const cell = normaliseCell(cellRaw)
						const inputId = `${baseId}-${rowIndex}-${field.id}`
						const canExpression = fieldSupportsExpression && !field.disableAutoExpression

						const setCell = (newCell: ExpressionOrValue<JsonValue | undefined>) =>
							updateCell(rowIndex, field.id, newCell)
						const setCellValue = (v: JsonValue) => setCell({ isExpression: false, value: v })

						const input = (
							<OptionsInputControl
								inputId={inputId}
								allowInternalFields={false}
								isLocatedInGrid={isLocatedInGrid}
								entityType={entityType}
								option={field}
								value={cell.isExpression ? undefined : cell.value}
								setValue={setCellValue}
								readonly={disabled}
								localVariablesStore={localVariablesStore}
								features={getInputFeatures(field)}
							/>
						)

						return (
							<Fragment key={field.id}>
								<FormLabel
									htmlFor={inputId}
									className={classNames('col-sm-4 col-form-label col-form-label-sm ps-4', { displayNone: hidden })}
								>
									{field.label}
									<InputFeatureIcons
										{...(cell.isExpression ? ExpressionModeFeatures : (getInputFeatures(field) ?? {}))}
									/>
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
