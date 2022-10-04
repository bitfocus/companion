import React, { memo, useCallback, useContext, useEffect, useState } from 'react'
import { LoadingRetryOrError, sandbox, socketEmitPromise, SocketContext, ModulesContext } from '../util'
import { CRow, CCol, CButton } from '@coreui/react'
import {
	CheckboxInputField,
	ColorInputField,
	DropdownInputField,
	NumberInputField,
	TextInputField,
} from '../Components'
import { nanoid } from 'nanoid'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import sanitizeHtml from 'sanitize-html'

export function InstanceEditPanel({ instanceId, instanceStatus, doConfigureInstance, showHelp }) {
	console.log('status', instanceStatus)

	if (!instanceStatus) {
		return (
			<CRow className="edit-instance">
				<CCol xs={12}>
					<p>Waiting for connection to start...</p>
				</CCol>
				<LoadingRetryOrError dataReady={false} />
			</CRow>
		)
	}

	return (
		<InstanceEditPanelInner instanceId={instanceId} doConfigureInstance={doConfigureInstance} showHelp={showHelp} />
	)
}

const InstanceEditPanelInner = memo(function InstanceEditPanel({ instanceId, doConfigureInstance, showHelp }) {
	const socket = useContext(SocketContext)
	const modules = useContext(ModulesContext)

	const [error, setError] = useState(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const [configFields, setConfigFields] = useState(null)
	const [instanceConfig, setInstanceConfig] = useState(null)
	const [instanceLabel, setInstanceLabel] = useState(null)
	const [validFields, setValidFields] = useState(null)

	const [fieldVisibility, setFieldVisibility] = useState({})

	const doCancel = useCallback(() => {
		doConfigureInstance(null)
		setConfigFields([])
	}, [doConfigureInstance])

	const doSave = useCallback(() => {
		setError(null)

		const isInvalid = Object.entries(validFields).filter(([k, v]) => !v)
		if (!instanceLabel?.trim() || isInvalid.length > 0) {
			setError(`Some config fields are not valid: ${isInvalid.map(([k]) => k).join(', ')}`)
			return
		}

		socketEmitPromise(socket, 'instances:set-config', [instanceId, instanceLabel, instanceConfig])
			.then((err) => {
				if (err) {
					if (err === 'duplicate label') {
						setError(
							`The label "${instanceConfig.label}" is already in use. Please use a unique label for this connection`
						)
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
	}, [socket, instanceId, validFields, instanceLabel, instanceConfig, doCancel])

	useEffect(() => {
		if (instanceId) {
			socketEmitPromise(socket, 'instances:edit', [instanceId])
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
						setInstanceLabel(res.label)
						setInstanceConfig(res.config)
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
			setInstanceLabel(null)
			setInstanceConfig(null)
			setValidFields(null)
		}
	}, [socket, instanceId, reloadToken])

	const doRetryConfigLoad = useCallback(() => setReloadToken(nanoid()), [])

	const setValue = useCallback((key, value) => {
		console.log('set value', key, value)

		setInstanceConfig((oldConfig) => ({
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

		if (configFields === null || instanceConfig === null) {
			return
		}
		for (const field of configFields) {
			if (typeof field.isVisible === 'function') {
				visibility[field.id] = field.isVisible(instanceConfig)
			}
		}

		setFieldVisibility(visibility)

		return () => {
			setFieldVisibility({})
		}
	}, [configFields, instanceConfig])

	const moduleInfo = modules[instanceConfig?.instance_type] ?? {}
	const dataReady = instanceConfig && configFields && validFields
	return (
		<div>
			<h5>
				{moduleInfo?.shortname ?? instanceConfig?.instance_type} configuration
				{moduleInfo?.hasHelp ? (
					<div className="instance_help" onClick={() => showHelp(instanceConfig?.instance_type)}>
						<FontAwesomeIcon icon={faQuestionCircle} />
					</div>
				) : (
					''
				)}
			</h5>
			<CRow className="edit-instance">
				<LoadingRetryOrError error={error} dataReady={dataReady} doRetry={doRetryConfigLoad} />
				{instanceId && dataReady ? (
					<>
						<CCol className={`fieldtype-textinput`} sm={12}>
							<label>Label</label>
							<TextInputField definition={{}} value={instanceLabel} setValue={setInstanceLabel} />
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
									<ConfigField
										definition={field}
										value={instanceConfig[field.id]}
										valid={validFields[field.id]}
										setValue={setValue}
										setValid={setValid}
									/>
								</CCol>
							)
						})}
					</>
				) : (
					''
				)}
			</CRow>

			<CRow>
				<CCol sm={12}>
					<CButton
						color="success"
						disabled={!validFields || Object.values(validFields).find((v) => !v) === false}
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

function ConfigField({ setValue, setValid, ...props }) {
	const id = props.definition.id
	const setValue2 = useCallback((val) => setValue(id, val), [setValue, id])
	const setValid2 = useCallback((valid) => setValid(id, valid), [setValid, id])

	const { definition } = props
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
			return <TextInputField {...props} setValue={setValue2} setValid={setValid2} />
		case 'number':
			return <NumberInputField {...props} setValue={setValue2} setValid={setValid2} />
		case 'checkbox':
			return <CheckboxInputField {...props} setValue={setValue2} setValid={setValid2} />
		case 'dropdown':
			return <DropdownInputField {...props} setValue={setValue2} setValid={setValid2} multiple={false} />
		case 'multidropdown':
			return <DropdownInputField {...props} setValue={setValue2} setValid={setValid2} multiple={true} />
		case 'colorpicker':
			return <ColorInputField {...props} setValue={setValue2} setValid={setValid2} />
		default:
			return <p>Unknown field "{definition.type}"</p>
	}
}
