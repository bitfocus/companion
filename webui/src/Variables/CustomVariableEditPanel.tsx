import { observer } from 'mobx-react-lite'
import { useContext, useId, useRef } from 'react'
import { CheckboxInputField } from '~/Components/CheckboxInputField.js'
import { CopyButton } from '~/Components/CopyButton'
import { Form, FormLabel } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { InlineHelpIcon } from '~/Components/InlineHelp'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import VariableInputGroup from '~/Components/VariableInputGroup.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useCustomVariablesApi } from './CustomVariablesApi'
import { useVariablesValuesForLabel } from './useVariablesValuesForLabel'

interface CustomVariableEditPanelProps {
	name: string
}

export const CustomVariableEditPanel = observer(function CustomVariableEditPanel({
	name,
}: CustomVariableEditPanelProps) {
	const { variablesStore } = useContext(RootAppStoreContext)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const customVariablesApi = useCustomVariablesApi(confirmModalRef)
	const customVariableValues = useVariablesValuesForLabel('custom')

	const info = variablesStore.customVariables.get(name)
	const value = customVariableValues.get(name)

	const persistFieldId = useId()
	const descriptionFieldId = useId()
	const currentValueFieldId = useId()
	const startupValueFieldId = useId()

	if (!info) return null

	const fullname = `$(custom:${name})`

	return (
		<div className="p-3">
			<GenericConfirmModal ref={confirmModalRef} />

			<div className="flex items-center gap-1.5 mb-3">
				<span className="variable-style">{fullname}</span>
				<CopyButton size="sm" title="Copy variable name" color="primary" variant="ghost" text={fullname} />
			</div>

			<Form onSubmit={PreventDefaultHandler}>
				<Grid.Row>
					<FormLabel htmlFor={descriptionFieldId} sm={3} className="align-right">
						Description:
					</FormLabel>
					<Grid.Col sm={9}>
						<TextInputFieldSimple
							id={descriptionFieldId}
							value={info.description}
							setValue={(description) => customVariablesApi.setDescription(name, description)}
							className="mb-2"
						/>
					</Grid.Col>

					<FormLabel htmlFor={currentValueFieldId} sm={3} className="align-right">
						Current value:
					</FormLabel>
					<Grid.Col sm={9}>
						<VariableInputGroup
							id={currentValueFieldId}
							value={value}
							setValue={(val) => customVariablesApi.setCurrentValue(name, val)}
						/>
					</Grid.Col>

					<FormLabel htmlFor={persistFieldId} sm={3} className="align-right">
						Persist value
						<InlineHelpIcon className="ms-1">
							If enabled, variable value will be saved and restored when Companion restarts.
						</InlineHelpIcon>
					</FormLabel>
					<Grid.Col sm={9} className="inline-flex items-center mb-2">
						<CheckboxInputField
							id={persistFieldId}
							value={info.persistCurrentValue}
							setValue={(val) => customVariablesApi.setPersistenceValue(name, val)}
						/>
					</Grid.Col>

					<FormLabel htmlFor={startupValueFieldId} sm={3} className="align-right">
						Startup value:
					</FormLabel>
					<Grid.Col sm={9}>
						<VariableInputGroup
							id={startupValueFieldId}
							disabled={!!info.persistCurrentValue}
							value={info.defaultValue}
							setValue={(val) => customVariablesApi.setStartupValue(name, val)}
						/>
					</Grid.Col>
				</Grid.Row>
			</Form>
		</div>
	)
})
