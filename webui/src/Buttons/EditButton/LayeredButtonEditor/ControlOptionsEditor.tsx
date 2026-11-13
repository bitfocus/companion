import { observer } from 'mobx-react-lite'
import { useCallback, useId, useRef } from 'react'
import type { JsonValue } from 'type-fest'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import { StepExpressionBlockedVariables } from '@companion-app/shared/ControlLocation.js'
import {
	LayeredButtonOptionsSchema,
	type LayeredButtonModel,
	type LayeredButtonOptions,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { CustomPresetModel } from '@companion-app/shared/Model/CustomPresetModel.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { DropdownChoice } from '@companion-module/base'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple'
import { ExpressionInputField } from '~/Components/ExpressionInputField'
import { Form, FormLabel } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { InputFeatureIcons } from '~/Controls/InputFeatures'
import { EntityListActionContext, type LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { useControlOptionsSetter } from '~/Controls/useControlOptionsSetter.js'
import { PreventDefaultHandler } from '~/Resources/util.js'

interface ControlOptionsEditorProps {
	controlId: SomeControlId
	/** The type of the control, which is a button or a custom preset built like one */
	controlType: LayeredButtonModel['type'] | CustomPresetModel['type']
	options: LayeredButtonOptions
	configRef: React.RefObject<LayeredButtonModel | CustomPresetModel>
	localVariablesStore: LocalVariablesStore
}

export const ControlOptionsEditor = observer(function ControlOptionsEditor({
	controlId,
	controlType,
	options,
	configRef,
	localVariablesStore,
}: ControlOptionsEditorProps): React.JSX.Element | null {
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const setOption = useControlOptionsSetter(controlId, controlType)

	const setValueInner = useCallback(
		<K extends keyof LayeredButtonOptions>(key: K, value: LayeredButtonOptions[K]) => {
			if (value !== configRef.current.options[key]) {
				setOption(key, value).catch((e) => {
					console.error(`Set field failed: ${stringifyError(e)}`)
				})
			}
		},
		[setOption, configRef]
	)

	const setStepProgressionValue = useCallback(
		(val: JsonValue) => {
			const stepProgression = LayeredButtonOptionsSchema.shape.stepProgression.safeParse(val)
			if (stepProgression.success) setValueInner('stepProgression', stepProgression.data)
		},
		[setValueInner]
	)
	const setStepExpressionValue = useCallback((val: string) => setValueInner('stepExpression', val), [setValueInner])
	const setRotaryActions = useCallback(
		(val: boolean) => {
			if (!val && confirmRef.current && configRef.current.options.rotaryActions === true) {
				confirmRef.current.show(
					'Disable rotary actions',
					'Are you sure? This will clear any rotary actions that have been defined.',
					'OK',
					() => {
						setValueInner('rotaryActions', val)
					}
				)
			} else {
				setValueInner('rotaryActions', val)
			}
		},
		[setValueInner, configRef]
	)
	const setCanModifyStyleInApis = useCallback(
		(val: boolean) => setValueInner('canModifyStyleInApis', val),
		[setValueInner]
	)

	const localVariables = localVariablesStore
		.getOptions({
			entityType: null,
			internalParser: false,
			isLocatedInGrid: true,
			actionContext: EntityListActionContext.NotActions,
		})
		.filter((v) => !StepExpressionBlockedVariables.has(String(v.value)))

	const stepProgressionId = useId()
	const stepExpressionId = useId()
	const rotaryActionsId = useId()
	const canModifyStyleInApisId = useId()

	return (
		<>
			<GenericConfirmModal ref={confirmRef} />
			<Form row className="gap-2 grow" onSubmit={PreventDefaultHandler}>
				<FormLabel htmlFor={stepProgressionId} sm={4} column="sm">
					Step Progression
					<InlineHelpIcon className="ms-1">
						When this button has multiple steps, control how the next step changes
					</InlineHelpIcon>
				</FormLabel>
				<Grid.Col sm={8}>
					<SimpleDropdownInputField
						id={stepProgressionId}
						choices={STEP_PROGRESSION_CHOICES}
						setValue={setStepProgressionValue}
						value={options.stepProgression}
					/>
				</Grid.Col>

				{options.stepProgression === 'expression' && (
					<>
						<FormLabel htmlFor={stepExpressionId} sm={4} column="sm">
							Step Progression Expression <InputFeatureIcons variables local />
						</FormLabel>
						<Grid.Col sm={8}>
							<ExpressionInputField
								id={stepExpressionId}
								setValue={setStepExpressionValue}
								value={options.stepExpression ?? ''}
								localVariables={localVariables}
							/>
						</Grid.Col>
					</>
				)}

				<FormLabel htmlFor={rotaryActionsId} sm={4} column="sm">
					Rotary Actions
					<InlineHelpIcon className="ms-1">Make this button compatible with rotation events</InlineHelpIcon>
				</FormLabel>
				<Grid.Col sm={8}>
					<SwitchInputField id={rotaryActionsId} value={options.rotaryActions} setValue={setRotaryActions} />
				</Grid.Col>

				<FormLabel htmlFor={canModifyStyleInApisId} sm={4} column="sm">
					Allow style changes
					<InlineHelpIcon className="ms-1">
						Allow the external APIs and internal actions to modify the style of this button
					</InlineHelpIcon>
				</FormLabel>
				<Grid.Col sm={8}>
					<SwitchInputField
						id={canModifyStyleInApisId}
						value={options.canModifyStyleInApis}
						setValue={setCanModifyStyleInApis}
					/>
				</Grid.Col>
			</Form>
		</>
	)
})

const STEP_PROGRESSION_CHOICES: DropdownChoice[] = [
	{ id: 'auto', label: 'On button release' },
	{ id: 'manual', label: 'Manual' },
	{ id: 'expression', label: 'Expression' },
]
