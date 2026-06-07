import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'
import { useCallback, useMemo, useRef } from 'react'
import type { JsonValue } from 'type-fest'
import type { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { InternalInputFieldTable, SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { getInputFeatures } from '~/Controls/InputFeatures.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { OptionsInputControl } from '~/Controls/OptionsInputControl.js'
import { Button } from './Button.js'

function columnDefault(col: SomeCompanionInputField): JsonValue {
	if ('default' in col && col.default !== undefined) return col.default
	return null
}

function newRow(columns: SomeCompanionInputField[]): Record<string, JsonValue> {
	const row: Record<string, JsonValue> = { _id: nanoid() }
	for (const col of columns) row[col.id] = columnDefault(col)
	return row
}

function firstNumberColId(columns: SomeCompanionInputField[]): string | undefined {
	return columns.find((c) => c.type === 'number')?.id
}

interface TableInputFieldProps {
	definition: InternalInputFieldTable
	value: Record<string, JsonValue>[] | undefined
	setValue: (rows: Record<string, JsonValue>[]) => void
	disabled?: boolean
	localVariablesStore: LocalVariablesStore | null
	entityType: EntityModelType | null
	isLocatedInGrid: boolean
}

export function TableInputField({
	definition,
	value,
	setValue,
	disabled,
	localVariablesStore,
	entityType,
	isLocatedInGrid,
}: TableInputFieldProps): React.JSX.Element {
	const { columns } = definition
	const sortColId = useMemo(() => firstNumberColId(columns), [columns])

	const sortedRows = useMemo(() => {
		const rows = value ?? []
		if (!sortColId) return rows
		return [...rows].sort((a, b) => Number(a[sortColId] ?? 0) - Number(b[sortColId] ?? 0))
	}, [value, sortColId])

	const sortedRowsRef = useRef(sortedRows)
	sortedRowsRef.current = sortedRows

	const valueRef = useRef(value)
	valueRef.current = value

	const addRow = useCallback(() => {
		setValue([...(valueRef.current ?? []), newRow(columns)])
	}, [columns, setValue])

	const removeRow = useCallback(
		(rowIndex: number) => {
			setValue(sortedRowsRef.current.filter((_, i) => i !== rowIndex))
		},
		[setValue]
	)

	const updateCell = useCallback(
		(rowIndex: number, colId: string, cellValue: JsonValue) => {
			setValue(sortedRowsRef.current.map((row, i) => (i === rowIndex ? { ...row, [colId]: cellValue } : row)))
		},
		[setValue]
	)

	return (
		<div>
			{sortedRows.length > 0 && (
				<table className="table table-sm mb-1">
					<thead>
						<tr>
							{columns.map((col) => (
								<th key={col.id} className="fw-normal text-muted ps-0">
									{col.label}
								</th>
							))}
							<th />
						</tr>
					</thead>
					<tbody>
						{sortedRows.map((row, rowIndex) => (
							<tr key={(row['_id'] as string | undefined) ?? rowIndex}>
								{columns.map((col) => (
									<td key={col.id} className="ps-0">
										<OptionsInputControl
											inputId={undefined}
											allowInternalFields={false}
											isLocatedInGrid={isLocatedInGrid}
											entityType={entityType}
											option={col}
											value={row[col.id]}
											setValue={(v) => updateCell(rowIndex, col.id, v)}
											readonly={disabled}
											localVariablesStore={localVariablesStore}
											features={getInputFeatures(col)}
										/>
									</td>
								))}
								<td className="ps-1" style={{ width: 1 }}>
									<Button
										color="danger"
										size="sm"
										onClick={() => removeRow(rowIndex)}
										disabled={disabled}
										title="Remove row"
									>
										<FontAwesomeIcon icon={faTrash} />
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			<Button color="primary" size="sm" onClick={addRow} disabled={disabled}>
				<FontAwesomeIcon icon={faPlus} className="me-1" />
				Add row
			</Button>
		</div>
	)
}
