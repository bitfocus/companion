import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faPalette, faPencil, faSquareRootVariable, faToggleOn, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { nanoid } from 'nanoid'
import { useCallback, useState } from 'react'
import type { JsonValue } from 'type-fest'
import { getElementSchemaProperty } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type FeedbackEntityModel,
	type FeedbackEntityStyleOverride,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { ButtonStylePropertiesWithBuffer } from '@companion-app/shared/Style.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { Button } from '~/Components/Button.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { ExpressionInputField } from '~/Components/ExpressionInputField.js'
import { ExpressionValuePreview } from '~/Components/ExpressionValuePreview.js'
import { FieldOrExpression } from '~/Components/FieldOrExpression.js'
import { InlineHelpCustom } from '~/Components/InlineHelp.js'
import { Table } from '~/Components/Table.js'
import { useComputed } from '~/Resources/util.js'
import type { IEntityEditorActionService } from '~/Services/Controls/ControlEntitiesService'
import {
	EntityListActionContext,
	FeedbackValueContextVariables,
	type LocalVariablesStore,
} from '../LocalVariablesStore.js'
import { OptionsInputControl } from '../OptionsInputControl.js'
import { AddElementPickerModal } from './AddElementPickerModal.js'
import { ElementPickerModal } from './ElementPickerModal.js'
import { useEntityEditorContext } from './EntityEditorContext.js'
import { useLayeredStyleElementsContext } from './LayeredStyleElementsContext.js'

interface LayeredStylesOverridesProps {
	feedback: FeedbackEntityModel
	feedbackType: FeedbackEntitySubType | null | undefined
	service: IEntityEditorActionService
	localVariablesStore: LocalVariablesStore | null
}

/**
 * The value a freshly-added style override starts from. Value feedbacks override via an expression
 * transform of `$(this:value)` (the feedback's current value), so their overrides are seeded as that
 * expression. Other feedback types start from an empty plain value.
 */
export function defaultStyleOverrideValue(
	feedbackType: FeedbackEntitySubType | null | undefined
): ExpressionOrValue<JsonValue | undefined> {
	return feedbackType === FeedbackEntitySubType.Value
		? { isExpression: true, value: '$(this:value)' }
		: { isExpression: false, value: '' }
}

/**
 * Describe how a feedback of the given type interacts with the style overrides below it, shown as the
 * hover text on the style-overrides indicator icon. Returns null for types with no style-override editor.
 *
 * Note: the module-api name for the legacy style feedback is "advanced", but that is not surfaced to
 * users - it is the oldest/most basic feedback type, and calling it "advanced" is misleading.
 */
export function feedbackTypeInteractionHelp(
	feedbackType: FeedbackEntitySubType | null | undefined
): { icon: IconDefinition; title: string; description: string } | null {
	switch (feedbackType) {
		case FeedbackEntitySubType.Value:
			return {
				icon: faSquareRootVariable,
				title: 'Value feedback',
				description:
					'Each override is an expression that can transform the feedback value with $(this:value). The property is overridden unless the expression returns undefined.',
			}
		case FeedbackEntitySubType.Boolean:
			return {
				icon: faToggleOn,
				title: 'Boolean feedback',
				description: 'The overrides below are applied whenever the feedback is active.',
			}
		case FeedbackEntitySubType.Advanced:
			return {
				icon: faPalette,
				title: 'Legacy style feedback',
				description:
					'An older style-based feedback. Each override copies one of the style properties it produces onto an element property.',
			}
		default:
			return null
	}
}

const FeedbackTypeIndicator = observer(function FeedbackTypeIndicator({
	feedbackType,
}: {
	feedbackType: FeedbackEntitySubType | null | undefined
}) {
	const info = feedbackTypeInteractionHelp(feedbackType)
	if (!info) return null

	return (
		<InlineHelpCustom
			help={
				<>
					<strong>{info.title}</strong>
					<br />
					{info.description}
				</>
			}
		>
			<FontAwesomeIcon icon={info.icon} className="text-info" />
		</InlineHelpCustom>
	)
})

export const LayeredStylesOverrides = observer(function LayeredStylesOverrides({
	feedback,
	feedbackType,
	service,
	localVariablesStore,
}: LayeredStylesOverridesProps) {
	const { styleStore } = useLayeredStyleElementsContext()

	// Create a flat list of element IDs in their visual order (depth-first traversal)
	const elementOrderMap = useComputed(() => {
		const orderMap = new Map<string, number>()
		let index = 0

		const traverse = (elements: SomeButtonGraphicsElement[]) => {
			for (const element of elements) {
				orderMap.set(element.id, index++)
				if (element.type === 'group' && element.children) {
					traverse(element.children)
				}
			}
		}

		traverse(styleStore.elements)
		return orderMap
	}, [styleStore.elements])

	// Sort overrides by element order, then by property name
	const overrides = useComputed(() => {
		const rawOverrides = feedback.styleOverrides || []
		return [...rawOverrides].sort((a, b) => {
			// Primary sort: element order
			const aOrder = elementOrderMap.get(a.elementId) ?? Infinity
			const bOrder = elementOrderMap.get(b.elementId) ?? Infinity

			if (aOrder !== bOrder) {
				// Reverse order
				return bOrder - aOrder
			}

			// Secondary sort: property name
			const selectedElementA = styleStore.findElementById(a.elementId)
			const selectedElementB = styleStore.findElementById(b.elementId)
			const selectedPropertyA = getElementSchemaProperty(selectedElementA?.type, a.elementProperty)
			const selectedPropertyB = getElementSchemaProperty(selectedElementB?.type, b.elementProperty)

			const propertyNameA = selectedPropertyA?.label || a.elementProperty
			const propertyNameB = selectedPropertyB?.label || b.elementProperty

			return propertyNameA.localeCompare(propertyNameB)
		})
	}, [feedback.styleOverrides, elementOrderMap, styleStore])

	const deleteRow = useCallback((id: string) => service.removeStyleOverride(id), [service])
	const updateRow = useCallback(
		(override: FeedbackEntityStyleOverride) => service.replaceStyleOverride(override),
		[service]
	)

	const handleAddModalSave = useCallback(
		(elementId: string, properties: string[]) => {
			console.log('AddElementPickerModal save:', { elementId, properties })

			const defaultOverride = defaultStyleOverrideValue(feedbackType)

			// Create multiple overrides, one for each selected property
			properties.forEach((propertyId) => {
				const newOverride: FeedbackEntityStyleOverride = {
					overrideId: nanoid(),
					elementId,
					elementProperty: propertyId,
					override: defaultOverride,
				}
				service.replaceStyleOverride(newOverride)
			})
		},
		[service, feedbackType]
	)

	return (
		<>
			<hr />

			<div className="flex justify-between items-center mb-2">
				<span className="flex items-center gap-2">
					<strong>Style Overrides</strong>
					<FeedbackTypeIndicator feedbackType={feedbackType} />
				</span>
				<div></div>
			</div>

			<Table className="width-100 layered-overrides-table">
				<thead>
					<tr>
						<th>Element & Property</th>
						<th>Value</th>
						<th className="fit">
							<AddElementPickerModal onSave={handleAddModalSave} />
						</th>
					</tr>
				</thead>
				<tbody>
					{overrides.length === 0 && (
						<tr>
							<td colSpan={3} className="text-center p-2">
								This feedback has no effect. Try adding an override
							</td>
						</tr>
					)}
					{overrides.map((row) => (
						<LayeredStylesOverridesRow
							key={row.overrideId}
							row={row}
							updateRow={updateRow}
							deleteRow={deleteRow}
							localVariablesStore={localVariablesStore}
							feedbackType={feedbackType}
						/>
					))}
				</tbody>
			</Table>
		</>
	)
})

interface LayeredStylesOverridesRowProps {
	row: FeedbackEntityStyleOverride
	updateRow: (override: FeedbackEntityStyleOverride) => void
	deleteRow: (id: string) => void
	localVariablesStore: LocalVariablesStore | null
	feedbackType: FeedbackEntitySubType | null | undefined
}
const LayeredStylesOverridesRow = observer(function LayeredStylesOverridesRow({
	row,
	updateRow,
	deleteRow,
	localVariablesStore,
	feedbackType,
}: LayeredStylesOverridesRowProps) {
	const [isModalOpen, setIsModalOpen] = useState(false)

	const handleModalSave = useCallback(
		(override: FeedbackEntityStyleOverride) => {
			updateRow(override)
			setIsModalOpen(false)
		},
		[updateRow]
	)

	return (
		<>
			<tr key={row.overrideId}>
				<td>
					<div className="flex items-center cursor-pointer" onClick={() => setIsModalOpen(true)}>
						<div className="grow">
							<SelectedElementProperty row={row} />
						</div>
						<Button size="sm" title="Edit element and property">
							<FontAwesomeIcon icon={faPencil} />
						</Button>
					</div>
					<OverrideValuePreview row={row} />
				</td>
				<td>
					<PropertyValueInput
						row={row}
						updateRow={updateRow}
						localVariablesStore={localVariablesStore}
						feedbackType={feedbackType}
					/>
				</td>
				<td>
					<Button size="sm" title="Delete override" onClick={() => deleteRow(row.overrideId)}>
						<FontAwesomeIcon icon={faTrash} />
					</Button>
				</td>
			</tr>

			<ElementPickerModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSave={handleModalSave}
				currentOverride={row}
			/>
		</>
	)
})

const SelectedElementProperty = observer(function SelectedElementProperty({
	row,
}: {
	row: FeedbackEntityStyleOverride
}) {
	const { styleStore } = useLayeredStyleElementsContext()

	if (!row.elementId || !row.elementProperty) return <div className="text-muted">No element selected</div>

	const selectedElement = row.elementId ? styleStore.findElementById(row.elementId) : null
	const selectedProperty = getElementSchemaProperty(selectedElement?.type, row.elementProperty)

	return (
		<>
			<div className="font-semibold">{selectedElement?.name || row.elementId}</div>
			<div className="text-muted small">{selectedProperty?.label || row.elementProperty}</div>
		</>
	)
})

// Live preview of the evaluated override value, shown under the element/property label (mirroring where
// entity option fields show their expression preview). Only rendered when the override is an expression.
const OverrideValuePreview = observer(function OverrideValuePreview({ row }: { row: FeedbackEntityStyleOverride }) {
	const { styleStore } = useLayeredStyleElementsContext()
	const { controlId } = useEntityEditorContext()

	if (!row.override.isExpression) return null

	const selectedElement = row.elementId ? styleStore.findElementById(row.elementId) : null
	const selectedProperty = getElementSchemaProperty(selectedElement?.type, row.elementProperty)
	if (!selectedProperty) return null

	return (
		<ExpressionValuePreview
			expression={stringifyVariableValue(row.override.value) ?? ''}
			controlId={controlId}
			fieldDefinition={selectedProperty}
		/>
	)
})

const PropertyValueInput = observer(function PropertyValueInput({
	row,
	updateRow,
	localVariablesStore,
	feedbackType,
}: {
	row: FeedbackEntityStyleOverride
	updateRow: (override: FeedbackEntityStyleOverride) => void
	localVariablesStore: LocalVariablesStore | null
	feedbackType: FeedbackEntitySubType | null | undefined
}) {
	const { styleStore } = useLayeredStyleElementsContext()

	const selectedElement = row.elementId ? styleStore.findElementById(row.elementId) : null
	const selectedProperty = getElementSchemaProperty(selectedElement?.type, row.elementProperty)

	const setOverride = useCallback(
		(override: ExpressionOrValue<JsonValue | undefined>) => {
			updateRow({ ...row, override })
		},
		[row, updateRow]
	)

	const inputId = undefined

	// If no property is selected, return null
	if (!selectedProperty) {
		return null
	}

	// For advanced feedbacks, show a dropdown with ButtonStylePropertiesWithBuffer instead of freeform input
	switch (feedbackType) {
		case FeedbackEntitySubType.Advanced:
			return (
				<DropdownInputField
					htmlName={inputId}
					choices={ButtonStylePropertiesWithBuffer}
					value={row.override.value as DropdownChoiceId}
					setValue={(value) =>
						updateRow({ ...row, override: { ...row.override, value } as ExpressionOrValue<JsonValue | undefined> })
					}
				/>
			)
		case FeedbackEntitySubType.Boolean:
			// For boolean feedbacks, show a dropdown with "true" and "false"
			return (
				<FieldOrExpression
					inputId={inputId}
					value={row.override}
					setValue={setOverride}
					localVariablesStore={localVariablesStore}
					entityType={null}
					isLocatedInGrid={true}
					disabled={false}
				>
					<OptionsInputControl
						inputId={inputId}
						allowInternalFields={true}
						isLocatedInGrid={false}
						entityType={EntityModelType.Feedback}
						option={selectedProperty}
						value={row.override.value}
						setValue={(val: JsonValue | undefined) => setOverride({ isExpression: false, value: val })}
						readonly={false}
						localVariablesStore={localVariablesStore}
					/>
				</FieldOrExpression>
			)
		case FeedbackEntitySubType.Value:
			// Value feedbacks always override via an expression, transforming `$(this:value)` (the feedback's
			// current value). An expression returning `undefined` means "no override".
			return (
				<ValueFeedbackOverrideInput
					inputId={inputId}
					value={row.override.isExpression ? (stringifyVariableValue(row.override.value) ?? '') : ''}
					setValue={(value) => setOverride({ isExpression: true, value })}
					localVariablesStore={localVariablesStore}
				/>
			)
		case FeedbackEntitySubType.StyleOverride:
		case undefined:
		case null:
			return <p>Unsupported feedback type</p>
		default:
			assertNever(feedbackType)
			return <p>Unsupported feedback type</p>
	}
})

const ValueFeedbackOverrideInput = observer(function ValueFeedbackOverrideInput({
	inputId,
	value,
	setValue,
	localVariablesStore,
}: {
	inputId: string | undefined
	value: string
	setValue: (value: string) => void
	localVariablesStore: LocalVariablesStore | null
}) {
	// Offer the control's local variables plus the `$(this:value)` context variable in the picker
	const expressionLocalVariables = useComputed(
		() => [
			...(localVariablesStore?.getOptions({
				entityType: EntityModelType.Feedback,
				internalParser: true,
				isLocatedInGrid: true,
				actionContext: EntityListActionContext.NotActions,
			}) ?? []),
			...FeedbackValueContextVariables,
		],
		[localVariablesStore]
	)

	return (
		<ExpressionInputField id={inputId} value={value} setValue={setValue} localVariables={expressionLocalVariables} />
	)
})
