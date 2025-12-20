import { CFormLabel, CFormSwitch } from '@coreui/react'
import React, { useCallback, useRef, type MutableRefObject } from 'react'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { InlineHelp } from '~/Components/InlineHelp.js'
import type { NormalButtonOptions } from '@companion-app/shared/Model/ButtonModel.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { ExpressionInputField } from '~/Components/ExpressionInputField.js'
import { ControlLocalVariables } from './LocalVariablesStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { InputFeatureIcons } from './OptionsInputField.js'

interface ControlOptionsEditorProps {
	controlId: string
	options: NormalButtonOptions
	configRef: MutableRefObject<any> // TODO
}

export function ControlOptionsEditor({ controlId, options, configRef }: ControlOptionsEditorProps): JSX.Element | null {
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const setValueInner = useCallback(
		(key: string, value: any) => {
			if (configRef.current === undefined || value !== configRef.current.options[key]) {
				setOptionsFieldMutation
					.mutateAsync({
						controlId,
						key,
						value,
					})
					.catch((e) => {
						console.error(`Set field failed: ${e}`)
					})
			}
		},
		[setOptionsFieldMutation, controlId, configRef]
	)

	const setStepProgressionValue = useCallback((val: any) => setValueInner('stepProgression', val), [setValueInner])
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

	return (
		<>
			<GenericConfirmModal ref={confirmRef} />
			<div className="flex w-full gap-2rem flex-form">
				<div>
					<CFormLabel>
						<InlineHelp help="When this button has multiple steps, progress to the next step when the button is released">
							Step Progression
						</InlineHelp>
					</CFormLabel>
					<br />
					<DropdownInputField
						choices={STEP_PROGRESSION_CHOICES}
						setValue={setStepProgressionValue}
						value={options.stepProgression}
					/>
				</div>

				<div>
					<CFormLabel>
						<InlineHelp help="Make this button compatible with rotation events">Rotary Actions</InlineHelp>
					</CFormLabel>
					<br />
					<CFormSwitch
						size="xl"
						color="success"
						checked={options.rotaryActions}
						onChange={() => {
							setRotaryActions(!options.rotaryActions)
						}}
					/>
				</div>
			</div>

			{options.stepProgression === 'expression' && (
				<div className="flex w-full gap-2rem flex-form">
					<div style={{ width: '100%' }}>
						<CFormLabel>
							Step Progression Expression <InputFeatureIcons variables local />
						</CFormLabel>
						<ExpressionInputField
							setValue={setStepExpressionValue}
							value={options.stepExpression ?? ''}
							localVariables={ControlLocalVariables}
						/>
					</div>
				</div>
			)}
		</>
	)
}

const STEP_PROGRESSION_CHOICES: DropdownChoice[] = [
	{ id: 'auto', label: 'Auto' },
	{ id: 'manual', label: 'Manual' },
	{ id: 'expression', label: 'Expression' },
]
