import React, { memo, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LoadingRetryOrError, sandbox, socketEmitPromise, SocketContext, ModulesContext } from '../util'
import { CRow, CCol, CButton } from '@coreui/react'
import { ColorInputField, DropdownInputField, NumberInputField, TextInputField } from '../Components'
import { nanoid } from 'nanoid'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import sanitizeHtml from 'sanitize-html'
import { isLabelValid } from '@companion/shared/Label'
import CSwitch from '../CSwitch'
import { BonjourDeviceInputField } from '../Components/BonjourDeviceInputField'

export function ConnectionEditPanel({ connectionId, connectionStatus, doConfigureConnection, showHelp }) {
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

const ConnectionEditPanelInner = memo(function ConnectionEditPanelInner({
	connectionId,
	doConfigureConnection,
	showHelp,
}) {
	const socket = useContext(SocketContext)
	const modules = useContext(ModulesContext)

	const [error, setError] = useState(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const [configFields, setConfigFields] = useState(null)
	const [connectionConfig, setConnectionConfig] = useState(null)
	const [connectionLabel, setConnectionLabel] = useState(null)
	const [connectionType, setConnectionType] = useState(null)
	const [validFields, setValidFields] = useState(null)

	const [fieldVisibility, setFieldVisibility] = useState({})

	const invalidFieldNames = useMemo(() => {
		const fieldNames = []

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

		if (!isLabelValid(newLabel) || invalidFieldNames.length > 0) {
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
						const validFields = {}
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

	const setValue = useCallback((key, value) => {
		console.log('set value', key, value)

		setConnectionConfig((oldConfig) => ({
			...oldConfig,
			[key]: value,
		}))
	}, [])
	const setValid = useCallback((key, isValid) => {
		console.log('set valid', key, isValid)

		setValidFields((oldValid) => ({
			...oldValid,
			[key]: isValid,
		}))
	}, [])

	useEffect(() => {
		const visibility = {}

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

	const moduleInfo = modules[connectionType] ?? {}
	const dataReady = connectionConfig && configFields && validFields
	return (
		<div>
			<h5>
				{moduleInfo?.shortname ?? connectionType} configuration
				{moduleInfo?.hasHelp && (
					<div className="float_right" onClick={() => showHelp(connectionType)}>
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
								value={connectionLabel}
								setValue={setConnectionLabel}
								isValid={isLabelValid(connectionLabel)}
							/>
						</CCol>

						{configFields.map((field, i) => {
							return (
								<CCol
									key={i}
									className={`fieldtype-${field.type}`}
									sm={field.width}
									style={{ display: fieldVisibility[field.id] === false ? 'none' : null }}
								>
									<label>{field.label}</label>
									{field.tooltip && (
										<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} title={field.tooltip} />
									)}
									<ConfigField
										definition={field}
										value={connectionConfig[field.id]}
										valid={validFields[field.id]}
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
						disabled={!validFields || invalidFieldNames.length > 0 || !isLabelValid(connectionLabel)}
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

function ConfigField({ setValue, setValid, definition, value, connectionId }) {
	const id = definition.id
	const setValue2 = useCallback((val) => setValue(id, val), [setValue, id])
	const setValid2 = useCallback((valid) => setValid(id, valid), [setValid, id])

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
					allowCustom={definition.allowCustom}
					minSelection={definition.minSelection}
					minChoicesForSearch={definition.minChoicesForSearch}
					maxSelection={definition.maxSelection}
					regex={definition.regex}
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
			return <p>Unknown field "{definition.type}"</p>
	}
}
