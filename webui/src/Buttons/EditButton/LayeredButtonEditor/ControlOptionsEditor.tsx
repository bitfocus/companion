import { CCol, CForm, CFormLabel, CFormSwitch } from '@coreui/react'
import React, { type MutableRefObject, useCallback, useRef } from 'react'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { InlineHelp } from '~/Components/InlineHelp.js'
import type { LayeredButtonOptions } from '@companion-app/shared/Model/ButtonModel.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import type { DropdownChoice } from '@companion-module/base'
import { ControlLocalVariables } from '~/Controls/LocalVariablesStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { ExpressionInputField } from '~/Components/ExpressionInputField'
import { InputFeatureIcons } from '~/Controls/OptionsInputField'

interface ControlOptionsEditorProps {
	controlId: string
	options: LayeredButtonOptions
	configRef: MutableRefObject<any> // TODO
}

export function ControlOptionsEditor({ controlId, options, configRef }: ControlOptionsEditorProps): JSX.Element | null {
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const setValueInner = useCallback(
		(key: string, value: any) => {
			if (configRef.current === undefined || value !== configRef.current.options[key]) {
				setOptionsFieldMutation.mutateAsync({ controlId, key, value }).catch((e) => {
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
	const setCanModifyStyleInApis = useCallback(
		(val: boolean) => setValueInner('canModifyStyleInApis', val),
		[setValueInner]
	)

	return (
		<>
			<GenericConfirmModal ref={confirmRef} />
			<CForm className="row g-2 grow" onSubmit={PreventDefaultHandler}>
				<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
					<InlineHelp help="When this button has multiple steps, control how the next step changes">
						Step Progression
					</InlineHelp>
				</CFormLabel>
				<CCol sm={8}>
					<DropdownInputField
						choices={STEP_PROGRESSION_CHOICES}
						setValue={setStepProgressionValue}
						value={options.stepProgression}
					/>
				</CCol>

				{options.stepProgression === 'expression' && (
					<>
						<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
							Step Progression Expression <InputFeatureIcons variables local />
						</CFormLabel>
						<CCol sm={8}>
							<ExpressionInputField
								setValue={setStepExpressionValue}
								value={options.stepExpression ?? ''}
								localVariables={ControlLocalVariables}
							/>
						</CCol>
					</>
				)}

				<CFormLabel htmlFor="colFormRotary" className="col-sm-4 col-form-label col-form-label-sm">
					<InlineHelp help="Make this button compatible with rotation events">Rotary Actions</InlineHelp>
				</CFormLabel>
				<CCol sm={8}>
					<CFormSwitch
						size="xl"
						color="success"
						checked={options.rotaryActions}
						onChange={() => {
							setRotaryActions(!options.rotaryActions)
						}}
					/>
				</CCol>

				<CFormLabel htmlFor="colFormProgress" className="col-sm-4 col-form-label col-form-label-sm">
					<InlineHelp help="Allow the external APIs and internal actions to modify the style of this button">
						Allow style changes
					</InlineHelp>
				</CFormLabel>
				<CCol sm={8}>
					<CFormSwitch
						size="xl"
						color="success"
						checked={options.canModifyStyleInApis}
						onChange={() => {
							setCanModifyStyleInApis(!options.canModifyStyleInApis)
						}}
					/>
				</CCol>
			</CForm>
		</>
	)
}

const STEP_PROGRESSION_CHOICES: DropdownChoice[] = [
	{ id: 'auto', label: 'On button release' },
	{ id: 'manual', label: 'Manual' },
	{ id: 'expression', label: 'Expression' },
]
