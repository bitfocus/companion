import React, { memo, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LoadingRetryOrError, sandbox, socketEmitPromise, SocketContext, ModulesContext } from '../util.js'
import { CRow, CCol, CButton } from '@coreui/react'
import { ColorInputField, DropdownInputField, NumberInputField, TextInputField } from '../Components/index.js'
import { nanoid } from 'nanoid'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import sanitizeHtml from 'sanitize-html'
import { isLabelValid } from '@companion/shared/Label.js'
import CSwitch from '../CSwitch.js'
import { BonjourDeviceInputField } from '../Components/BonjourDeviceInputField.js'
import { ConnectionStatusEntry } from '@companion/shared/Model/Common.js'
import { SomeCompanionConfigField } from '@companion-module/base'

interface ConnectionEditPanelProps {
	connectionId: string
	connectionStatus: ConnectionStatusEntry | undefined
	doConfigureConnection: (connectionId: string | null) => void
	showHelp: (moduleId: string) => void
}

export function ConnectionEditPanel({
	connectionId,
	connectionStatus,
	doConfigureConnection,
	showHelp,
}: ConnectionEditPanelProps) {
	console.log('status', connectionStatus)

	if (!connectionStatus || !connectionStatus.level || connectionStatus.level === 'crashed') {
		return (
			<CRow className="edit-connection">
				<CCol xs={12}>
					<p>Waiting for connection to start...</p>
				</CCol>
				<LoadingRetryOrError dataReady={false} />
			</CRow>
		)
	}

	return (
		<ConnectionEditPanelInner
			connectionId={connectionId}
			doConfigureConnection={doConfigureConnection}
			showHelp={showHelp}
		/>
	)
}

interface ConnectionEditPanelInnerProps {
	connectionId: string
	doConfigureConnection: (connectionId: string | null) => void
	showHelp: (moduleId: string) => void
}

const ConnectionEditPanelInner = memo(function ConnectionEditPanelInner({
	connectionId,
	doConfigureConnection,
	showHelp,
}: ConnectionEditPanelInnerProps) {
	const socket = useContext(SocketContext)
	const modules = useContext(ModulesContext)

	const [error, setError] = useState<string | null>(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const [configFields, setConfigFields] = useState<SomeCompanionConfigField[] | null>([])
	const [connectionConfig, setConnectionConfig] = useState<Record<string, any> | null>(null)
	const [connectionLabel, setConnectionLabel] = useState<string | null>(null)
	const [connectionType, setConnectionType] = useState<string | null>(null)
	const [validFields, setValidFields] = useState<Record<string, boolean | undefined> | null>(null)

	const [fieldVisibility, setFieldVisibility] = useState<Record<string, boolean>>({})

	const invalidFieldNames = useMemo(() => {
		const fieldNames: string[] = []

		if (validFields) {
			for (const [field, valid] of Object.entries(validFields)) {
				if (!valid && fieldVisibility[field] !== false) {
					fieldNames.push(field)
				}
			}
		}

		return fieldNames
	}, [validFields, fieldVisibility])

	const doCancel = useCallback(() => {
		doConfigureConnection(null)
		setConfigFields([])
	}, [doConfigureConnection])

	const doSave = useCallback(() => {
		setError(null)

		const newLabel = connectionLabel?.trim()

		if (!newLabel || !isLabelValid(newLabel) || invalidFieldNames.length > 0) {
			setError(`Some config fields are not valid: ${invalidFieldNames.join(', ')}`)
			return
		}

		socketEmitPromise(socket, 'connections:set-config', [connectionId, newLabel, connectionConfig])
			.then((err) => {
				if (err) {
					if (err === 'invalid label') {
						setError(`The label "${newLabel}" in not valid`)
					} else if (err === 'duplicate label') {
						setError(`The label "${newLabel}" is already in use. Please use a unique label for this connection`)
					} else {
						setError(`Unable to save connection config: "${err}"`)
					}
				} else {
					// Done
					doCancel()
				}
			})
			.catch((e) => {
				setError(`Failed to save connection config: ${e}`)
			})
	}, [socket, connectionId, invalidFieldNames, connectionLabel, connectionConfig, doCancel])

	useEffect(() => {
		if (connectionId) {
			socketEmitPromise(socket, 'connections:edit', [connectionId])
				.then((res) => {
					if (res) {
						const validFields: Record<string, boolean> = {}
						for (const field of res.fields) {
							// Real validation status gets generated when the editor components first mount
							validFields[field.id] = true

							// deserialize `isVisible` with a sandbox/proxy version
							if (typeof field.isVisibleFn === 'string') {
								field.isVisible = sandbox(field.isVisibleFn)
							}
						}

						setConfigFields(res.fields)
						setConnectionLabel(res.label)
						setConnectionType(res.instance_type)
						setConnectionConfig(res.config)
						setValidFields(validFields)
					} else {
						setError(`Connection config unavailable`)
					}
				})
				.catch((e) => {
					setError(`Failed to load connection info: "${e}"`)
				})
		}

		return () => {
			setError(null)
			setConfigFields(null)
			setConnectionLabel(null)
			setConnectionConfig(null)
			setValidFields(null)
		}
	}, [socket, connectionId, reloadToken])

	const doRetryConfigLoad = useCallback(() => setReloadToken(nanoid()), [])

	const setValue = useCallback((key: string, value: any) => {
		console.log('set value', key, value)

		setConnectionConfig((oldConfig) => ({
			...oldConfig,
			[key]: value,
		}))
	}, [])
	const setValid = useCallback((key: string, isValid: boolean) => {
		console.log('set valid', key, isValid)

		setValidFields((oldValid) => ({
			...oldValid,
			[key]: isValid,
		}))
	}, [])

	useEffect(() => {
		const visibility: Record<string, boolean> = {}

		if (configFields === null || connectionConfig === null) {
			return
		}
		for (const field of configFields) {
			if (typeof field.isVisible === 'function') {
				visibility[field.id] = field.isVisible(connectionConfig, field.isVisibleData)
			}
		}

		setFieldVisibility(visibility)

		return () => {
			setFieldVisibility({})
		}
	}, [configFields, connectionConfig])

	const moduleInfo = connectionType ? modules[connectionType] : undefined
	const dataReady = !!connectionConfig && !!configFields && !!validFields
	return (
		<div>
			<h5>
				{moduleInfo?.shortname ?? connectionType} configuration
				{moduleInfo?.hasHelp && (
					<div className="float_right" onClick={() => connectionType && showHelp(connectionType)}>
						<FontAwesomeIcon icon={faQuestionCircle} />
					</div>
				)}
			</h5>
			<CRow className="edit-connection">
				<LoadingRetryOrError error={error} dataReady={dataReady} doRetry={doRetryConfigLoad} autoRetryAfter={2} />
				{connectionId && dataReady && (
					<>
						<CCol className={`fieldtype-textinput`} sm={12}>
							<label>Label</label>
							<TextInputField
								value={connectionLabel ?? ''}
								setValue={setConnectionLabel}
								// isValid={isLabelValid(connectionLabel)}
							/>
						</CCol>

						{configFields.map((field, i) => {
							return (
								<CCol
									key={i}
									className={`fieldtype-${field.type}`}
									sm={field.width}
									style={{ display: fieldVisibility[field.id] === false ? 'none' : undefined }}
								>
									<label>{field.label}</label>
									{field.tooltip && (
										<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} title={field.tooltip} />
									)}
									<ConfigField
										definition={field}
										value={connectionConfig[field.id]}
										// valid={validFields[field.id] ?? false}
										setValue={setValue}
										setValid={setValid}
										connectionId={connectionId}
									/>
								</CCol>
							)
						})}
					</>
				)}
			</CRow>

			<CRow>
				<CCol sm={12}>
					<CButton
						color="success"
						disabled={
							!validFields || invalidFieldNames.length > 0 || !connectionLabel || !isLabelValid(connectionLabel)
						}
						onClick={doSave}
					>
						Save
					</CButton>

					<CButton color="secondary" className="ml-1" onClick={doCancel}>
						Cancel
					</CButton>
				</CCol>
			</CRow>
		</div>
	)
})

interface ConfigFieldProps {
	setValue: (key: string, value: any) => void
	setValid: (key: string, valid: boolean) => void
	definition: SomeCompanionConfigField
	value: any
	connectionId: string
}

function ConfigField({ setValue, setValid, definition, value, connectionId }: ConfigFieldProps) {
	const id = definition.id
	const setValue2 = useCallback((val: any) => setValue(id, val), [setValue, id])
	const setValid2 = useCallback((valid: boolean) => setValid(id, valid), [setValid, id])

	const fieldType = definition.type
	switch (definition.type) {
		case 'static-text': {
			const descriptionHtml = {
				__html: sanitizeHtml(definition.value ?? '', {
					allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
					disallowedTagsMode: 'escape',
				}),
			}

			return <p title={definition.tooltip} dangerouslySetInnerHTML={descriptionHtml}></p>
		}
		case 'textinput':
			return (
				<TextInputField
					value={value}
					regex={definition.regex}
					required={definition.required}
					setValue={setValue2}
					setValid={setValid2}
				/>
			)
		case 'number':
			return (
				<NumberInputField
					required={definition.required}
					min={definition.min}
					max={definition.max}
					step={definition.step}
					range={definition.range}
					value={value}
					setValue={setValue2}
					setValid={setValid2}
				/>
			)
		case 'checkbox':
			return (
				<div style={{ marginRight: 40, marginTop: 2 }}>
					<CSwitch
						color="success"
						checked={value}
						size={'lg'}
						tooltip={definition.tooltip}
						onChange={() => {
							setValue2(!value)
							//setValid2(true)
						}}
					/>
				</div>
			)
		case 'dropdown':
			return (
				<DropdownInputField
					choices={definition.choices}
					allowCustom={definition.allowCustom}
					minChoicesForSearch={definition.minChoicesForSearch}
					regex={definition.regex}
					value={value}
					setValue={setValue2}
					setValid={setValid2}
					multiple={false}
				/>
			)
		case 'multidropdown':
			return (
				<DropdownInputField
					choices={definition.choices}
					// allowCustom={definition.allowCustom}
					minSelection={definition.minSelection}
					minChoicesForSearch={definition.minChoicesForSearch}
					maxSelection={definition.maxSelection}
					// regex={definition.regex}
					value={value}
					setValue={setValue2}
					setValid={setValid2}
					multiple={true}
				/>
			)
		case 'colorpicker': {
			return (
				<ColorInputField
					value={value}
					setValue={setValue2}
					setValid={setValid2}
					enableAlpha={definition.enableAlpha ?? false}
					returnType={definition.returnType ?? 'number'}
					presetColors={definition.presetColors}
				/>
			)
			break
		}
		case 'bonjour-device':
			return (
				<BonjourDeviceInputField
					value={value}
					setValue={setValue2}
					connectionId={connectionId}
					queryId={definition.id}
				/>
			)
		default:
			return <p>Unknown field "{fieldType}"</p>
	}
}
