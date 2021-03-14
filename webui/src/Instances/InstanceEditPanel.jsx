import React, { memo, useCallback, useContext, useEffect, useState } from 'react'
import { CompanionContext, LoadingRetryOrError, socketEmit } from '../util'
import { CRow, CCol, CButton } from '@coreui/react'
import { CheckboxInputField, DropdownInputField, NumberInputField, TextInputField } from '../Components'
import shortid from 'shortid'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

export const InstanceEditPanel = memo(function InstanceEditPanel({ instanceId, doConfigureInstance, showHelp }) {
	const context = useContext(CompanionContext)

	const [error, setError] = useState(null)
	const [reloadToken, setReloadToken] = useState(shortid())

	const [configFields, setConfigFields] = useState(null)
	const [instanceConfig, setInstanceConfig] = useState(null)
	const [validFields, setValidFields] = useState(null)

	const doCancel = useCallback(() => {
		doConfigureInstance(null)
		setConfigFields([])
	}, [doConfigureInstance])

	const doSave = useCallback(() => {
		setError(null)

		const isInvalid = Object.entries(validFields).filter(([k, v]) => !v)
		if (isInvalid.length > 0) {
			setError(`Some config fields are not valid: ${isInvalid.map(([k]) => k).join(', ')}`)
			return
		}

		socketEmit(context.socket, 'instance_config_put', [instanceId, instanceConfig])
			.then(([err, ok]) => {
				if (err) {
					if (err === 'duplicate label') {
						setError(
							`The label "${instanceConfig.label}" is already in use. Please use a unique name for this module instance`
						)
					} else {
						setError(`Unable to save instance config: "${err}"`)
					}
				} else {
					// Done
					doCancel()
				}
			})
			.catch((e) => {
				setError(`Failed to save instance config: ${e}`)
			})
	}, [context.socket, instanceId, validFields, instanceConfig, doCancel])

	useEffect(() => {
		if (instanceId) {
			socketEmit(context.socket, 'instance_edit', [instanceId])
				.then(([_instanceId, _configFields, _instanceConfig]) => {
					const validFields = {}
					for (const field of _configFields) {
						// Real validation status gets generated when the editor components first mount
						validFields[field.id] = true
					}

					setConfigFields(_configFields)
					setInstanceConfig(_instanceConfig)
					setValidFields(validFields)
				})
				.catch((e) => {
					setError(`Failed to load instance edit info: "${e}"`)
				})
		}

		return () => {
			setError(null)
			setConfigFields(null)
			setInstanceConfig(null)
			setValidFields(null)
		}
	}, [context.socket, instanceId, reloadToken])

	const doRetryConfigLoad = useCallback(() => setReloadToken(shortid()), [])

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

	const moduleInfo = context.modules[instanceConfig?.instance_type] ?? {}
	const dataReady = instanceConfig && configFields && validFields
	return (
		<div>
			<h5>
				{moduleInfo?.shortname ?? instanceConfig?.instance_type} configuration
				{moduleInfo?.help ? (
					<div className="instance_help" onClick={() => showHelp(instanceConfig?.instance_type)}>
						<FontAwesomeIcon icon={faQuestionCircle} />
					</div>
				) : (
					''
				)}
			</h5>
			<CRow className="edit-instance">
				<LoadingRetryOrError error={error} dataReady={dataReady} doRetry={doRetryConfigLoad} />
				{instanceId && dataReady
					? configFields.map((field, i) => {
							return (
								<CCol key={i} className={`fieldtype-${field.type}`} sm={field.width}>
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
					  })
					: ''}
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
		case 'text':
			return (
				<p title={definition.tooltip}>
					<div dangerouslySetInnerHTML={{ __html: definition.value }} />
				</p>
			)
		case 'textinput':
			return <TextInputField {...props} setValue={setValue2} setValid={setValid2} />
		case 'number':
			return <NumberInputField {...props} setValue={setValue2} setValid={setValid2} />
		case 'checkbox':
			return <CheckboxInputField {...props} setValue={setValue2} setValid={setValid2} />
		case 'dropdown':
			return <DropdownInputField {...props} setValue={setValue2} setValid={setValid2} />
		default:
			return <p>Unknown field "{definition.type}"</p>
	}
}
