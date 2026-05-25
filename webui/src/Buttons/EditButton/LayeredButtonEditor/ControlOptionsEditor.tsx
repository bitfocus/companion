import { useCallback, useId, useRef, type MutableRefObject } from 'react'
import type { JsonValue } from 'type-fest'
import type { LayeredButtonOptions } from '@companion-app/shared/Model/ButtonModel.js'
import type { DropdownChoice } from '@companion-module/base'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple'
import { ExpressionInputField } from '~/Components/ExpressionInputField'
import { Form, FormLabel } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'
import { SwitchInputField } from '~/Components/SwitchInputField'
import { ControlLocalVariables } from '~/Controls/LocalVariablesStore.js'
import { InputFeatureIcons } from '~/Controls/OptionsInputField'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'

interface ControlOptionsEditorProps {
	controlId: string
	options: LayeredButtonOptions
	configRef: MutableRefObject<any> // TODO
}

export function ControlOptionsEditor({ controlId, options, configRef }: ControlOptionsEditorProps): JSX.Element | null {
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const setValueInner = useCallback(
		(key: string, value: JsonValue) => {
			if (configRef.current === undefined || value !== configRef.current.options[key]) {
				setOptionsFieldMutation.mutateAsync({ controlId, key, value }).catch((e) => {
					console.error(`Set field failed: ${e}`)
				})
			}
		},
		[setOptionsFieldMutation, controlId, configRef]
	)

	const setStepProgressionValue = useCallback(
		(val: JsonValue) => setValueInner('stepProgression', val),
		[setValueInner]
	)
	const setStepExpressionValue = useCallback((val: string) => setValueInner('stepExpression', val), [setValueInner])
	const setRotaryActions = useCallback(
		(val: boolean) => {
			if (!val && confirmRef.current && configRef.current && configRef.current.options.rotaryActions === true) {
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

	const stepProgressionId = useId()
	const stepExpressionId = useId()
	const rotaryActionsId = useId()
	const canModifyStyleInApisId = useId()

	return (
		<>
			<GenericConfirmModal ref={confirmRef} />
			<Form className="row g-2 grow" onSubmit={PreventDefaultHandler}>
				<FormLabel htmlFor={stepProgressionId} className="col-sm-4 col-form-label col-form-label-sm">
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
						<FormLabel htmlFor={stepExpressionId} className="col-sm-4 col-form-label col-form-label-sm">
							Step Progression Expression <InputFeatureIcons variables local />
						</FormLabel>
						<Grid.Col sm={8}>
							<ExpressionInputField
								id={stepExpressionId}
								setValue={setStepExpressionValue}
								value={options.stepExpression ?? ''}
								localVariables={ControlLocalVariables}
							/>
						</Grid.Col>
					</>
				)}

				<FormLabel htmlFor={rotaryActionsId} className="col-sm-4 col-form-label col-form-label-sm">
					Rotary Actions
					<InlineHelpIcon className="ms-1">Make this button compatible with rotation events</InlineHelpIcon>
				</FormLabel>
				<Grid.Col sm={8}>
					<SwitchInputField id={rotaryActionsId} value={options.rotaryActions} setValue={setRotaryActions} />
				</Grid.Col>

				<FormLabel htmlFor={canModifyStyleInApisId} className="col-sm-4 col-form-label col-form-label-sm">
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
}

const STEP_PROGRESSION_CHOICES: DropdownChoice[] = [
	{ id: 'auto', label: 'On button release' },
	{ id: 'manual', label: 'Manual' },
	{ id: 'expression', label: 'Expression' },
]
