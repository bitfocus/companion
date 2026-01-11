import { CFormLabel, CCol } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import React, { useCallback } from 'react'
import {
	type ButtonGraphicsElementBase,
	type SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import type { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import { InlineHelp } from '~/Components/InlineHelp.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'
import { ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'

export const ElementCommonProperties = observer(function ElementCommonProperties({
	elementProps,
}: {
	elementProps: Readonly<SomeButtonGraphicsElement>
}) {
	return (
		<>
			<CFormLabel htmlFor="inputName" className="col-sm-4 col-form-label col-form-label-sm">
				Element Name
			</CFormLabel>
			<CCol sm={8}>
				<FieldElementNameInput elementProps={elementProps} />
			</CCol>

			{elementProps.type !== 'canvas' && elementProps.type !== 'group' && (
				<>
					<CFormLabel htmlFor="inputUsage" className="col-sm-4 col-form-label col-form-label-sm">
						<InlineHelp help="Some surfaces do not have full rgb displays and require specific elements for providing feedback in alternate ways. You can override the automatic selection of elements for these purposes by selecting the appropriate usage for this element.">
							External Usage
						</InlineHelp>
					</CFormLabel>
					<CCol sm={8}>
						<FieldElementUsageInput elementProps={elementProps} />
					</CCol>
				</>
			)}
		</>
	)
})

const FieldElementNameInput = observer(function FieldElementNameInput({
	elementProps,
}: {
	elementProps: SomeButtonGraphicsElement
}) {
	const { controlId } = useElementPropertiesContext()
	const setElementNameMutation = useMutationExt(trpc.controls.styles.setElementName.mutationOptions())

	const setName = useCallback(
		(value: string) => {
			setElementNameMutation
				.mutateAsync({ controlId, elementId: elementProps.id, name: value })
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[setElementNameMutation, controlId, elementProps.id]
	)

	return <TextInputField setValue={setName} value={elementProps.name ?? ''} />
})

const FieldElementUsageInput = observer(function FieldElementUsageInput({
	elementProps,
}: {
	elementProps: ButtonGraphicsElementBase
}) {
	const { controlId } = useElementPropertiesContext()
	const setElementUsageMutation = useMutationExt(trpc.controls.styles.setElementUsage.mutationOptions())

	const setUsage = useCallback(
		(value: DropdownChoiceId) => {
			setElementUsageMutation
				.mutateAsync({
					controlId,
					elementId: elementProps.id,
					usage: value as ButtonGraphicsElementUsage,
				})
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[setElementUsageMutation, controlId, elementProps.id]
	)

	// TODO: Should the choices be dynamic based on the element type?
	return (
		<DropdownInputField
			setValue={setUsage}
			value={elementProps.usage as DropdownChoiceId}
			choices={elementUsageChoices}
		/>
	)
})

const elementUsageChoices: DropdownChoice[] = [
	{ id: ButtonGraphicsElementUsage.Automatic, label: 'Automatic' },
	{ id: ButtonGraphicsElementUsage.Text, label: 'Text' },
	{ id: ButtonGraphicsElementUsage.Color, label: 'Color' },
	{ id: ButtonGraphicsElementUsage.Image, label: 'Image' },
]
