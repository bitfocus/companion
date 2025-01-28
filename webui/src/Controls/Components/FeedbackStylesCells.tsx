import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { FeedbackEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { ButtonStyleProperties } from '@companion-app/shared/Style.js'
import { CAlert, CFormLabel, CCol } from '@coreui/react'
import React, { useState, useCallback, useMemo } from 'react'
import { DropdownInputField } from '../../Components/DropdownInputField.js'
import { MyErrorBoundary } from '../../util.js'
import { ButtonStyleConfigFields } from '../ButtonStyleConfig.js'
import { DropdownChoiceId } from '@companion-module/base'

interface FeedbackManageStylesProps {
	feedbackSpec: ClientEntityDefinition | undefined
	feedback: FeedbackEntityModel
	setSelectedStyleProps: (keys: string[]) => void
}

export function FeedbackManageStyles({ feedbackSpec, feedback, setSelectedStyleProps }: FeedbackManageStylesProps) {
	if (feedbackSpec?.feedbackType === 'boolean') {
		const choicesSet = new Set(ButtonStyleProperties.map((c) => c.id))
		const currentValue = Object.keys(feedback.style || {}).filter((id) => choicesSet.has(id))

		return (
			<>
				<hr />
				<CFormLabel htmlFor="colFormStyleProperties" className="col-sm-4 col-form-label col-form-label-sm">
					Change style properties
				</CFormLabel>
				<CCol sm={8}>
					<MyErrorBoundary>
						<DropdownInputField
							htmlName="colFormStyleProperties"
							multiple={true}
							choices={ButtonStyleProperties}
							setValue={setSelectedStyleProps as (keys: DropdownChoiceId[]) => void}
							value={currentValue}
						/>
					</MyErrorBoundary>
				</CCol>
			</>
		)
	} else {
		return null
	}
}

interface FeedbackStylesProps {
	feedbackSpec: ClientEntityDefinition | undefined
	feedback: FeedbackEntityModel
	setStylePropsValue: (key: string, value: any) => void
}

export function FeedbackStyles({ feedbackSpec, feedback, setStylePropsValue }: FeedbackStylesProps) {
	const [pngError, setPngError] = useState<string | null>(null)
	const clearPngError = useCallback(() => setPngError(null), [])
	const setPng = useCallback(
		(data: string | null) => {
			setPngError(null)
			setStylePropsValue('png64', data)
		},
		[setStylePropsValue]
	)
	const clearPng = useCallback(() => {
		setPngError(null)
		setStylePropsValue('png64', null)
	}, [setStylePropsValue])

	const currentStyle = useMemo(() => feedback?.style || {}, [feedback?.style])
	const showField = useCallback((id: string) => id in currentStyle, [currentStyle])

	if (feedbackSpec?.feedbackType === 'boolean') {
		return (
			<CCol sm={{ span: 8, offset: 4 }}>
				{pngError && (
					<CAlert color="warning" dismissible>
						{pngError}
					</CAlert>
				)}

				<ButtonStyleConfigFields
					values={currentStyle}
					setValueInner={setStylePropsValue}
					setPng={setPng}
					clearPng={clearPng}
					setPngError={clearPngError}
					showField={showField}
				/>
				{Object.keys(currentStyle).length === 0 ? 'Feedback has no effect. Try adding a property to override' : ''}
			</CCol>
		)
	} else {
		return null
	}
}
