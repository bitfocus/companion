import { faLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useId } from 'react'
import type { PresetReferenceButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation, DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import type { VariableValue } from '@companion-app/shared/Model/Variables.js'
import { Callout } from '~/Components/Callout.js'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import VariableInputGroup from '~/Components/VariableInputGroup.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler, useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface PresetReferenceEditorProps {
	config: PresetReferenceButtonModel
	location: ControlLocation
}

/**
 * Read-only editor shown for a placed preset reference. It explains that the button is linked to a preset
 * (and whether the source connection is currently available), lets the user switch which connection it
 * references (matched by module), and lets the user edit only the templated variable values - the only
 * editable fields on a reference.
 */
export const PresetReferenceEditor = observer(function PresetReferenceEditor({
	config,
	location,
}: PresetReferenceEditorProps) {
	const { connections } = useContext(RootAppStoreContext)

	const { connectionId, moduleId, variableValues } = config.presetRef
	const connectionInfo = connections.getInfo(connectionId)
	const sourceAvailable = !!connectionInfo && connectionInfo.enabled

	const connectionChoices = useComputed<DropdownChoice[]>(
		() =>
			connections
				.getAllOfModuleId(moduleId)
				.map((c) => ({ id: c.id, label: c.enabled ? c.label : `${c.label} (disabled)` })),
		[connections, moduleId]
	)

	const setConnectionMutation = useMutationExt(trpc.controls.setPresetReferenceConnection.mutationOptions())
	const setConnection = useCallback(
		(value: DropdownChoiceId) => {
			setConnectionMutation
				.mutateAsync({ location, connectionId: String(value) })
				.catch((err) => console.error(`Failed to switch preset reference connection: ${err}`))
		},
		[setConnectionMutation, location]
	)

	const connectionFieldId = useId()
	const templateVariableNames = Object.keys(variableValues ?? {})

	return (
		<>
			<Callout color="info" className="my-2">
				<div className="d-flex gap-2">
					<FontAwesomeIcon icon={faLink} className="mt-1" />
					<div>
						This button is <strong>linked</strong> to a preset. It updates automatically when the preset changes.
						<br />
						Use <strong>Edit</strong> above to unlink it into a normal, fully editable button.
					</div>
				</div>
			</Callout>

			{!sourceAvailable && (
				<Callout color="warning" className="my-2">
					The source {connectionInfo ? 'connection is disabled' : 'connection no longer exists'}. This button is showing
					its last known state.
				</Callout>
			)}

			<Form className="row g-2" onSubmit={PreventDefaultHandler}>
				<FormLabel htmlFor={connectionFieldId} className="col-sm-4 col-form-label col-form-label-sm">
					Connection
				</FormLabel>
				<Grid.Col sm={8}>
					<SimpleDropdownInputField
						id={connectionFieldId}
						choices={connectionChoices}
						value={connectionId}
						setValue={setConnection}
						badOptionPrefix="Unavailable"
						noOptionsMessage="No connections of this module"
					/>
				</Grid.Col>
			</Form>

			{templateVariableNames.length > 0 && (
				<>
					<h5 className="mt-3">Preset variables</h5>
					<p className="text-muted small">
						These values came from the preset template and can be customised. Other settings are managed by the preset.
					</p>
					<Form className="row g-2" onSubmit={PreventDefaultHandler}>
						{templateVariableNames.map((variableName) => (
							<PresetReferenceVariableRow
								key={variableName}
								location={location}
								variableName={variableName}
								value={variableValues?.[variableName]}
							/>
						))}
					</Form>
				</>
			)}
		</>
	)
})

interface PresetReferenceVariableRowProps {
	location: ControlLocation
	variableName: string
	value: VariableValue
}

function PresetReferenceVariableRow({ location, variableName, value }: PresetReferenceVariableRowProps) {
	const setVariableMutation = useMutationExt(trpc.controls.setPresetReferenceVariable.mutationOptions())

	const setValue = useCallback(
		(newValue: VariableValue | undefined) => {
			setVariableMutation
				.mutateAsync({ location, variableName, value: newValue })
				.catch((e) => console.error(`Failed to set preset reference variable: ${e}`))
		},
		[setVariableMutation, location, variableName]
	)

	const fieldId = useId()

	return (
		<>
			<FormLabel htmlFor={fieldId} className="col-sm-4 col-form-label col-form-label-sm">
				{variableName}
			</FormLabel>
			<Grid.Col sm={8}>
				<VariableInputGroup id={fieldId} value={value} setValue={setValue} />
			</Grid.Col>
		</>
	)
}
