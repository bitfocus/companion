import React, { forwardRef, memo, useCallback, useContext, useEffect, useImperativeHandle, useState } from 'react'
import { CompanionContext, LoadingRetryOrError, MyErrorBoundary, socketEmit } from '../util'
import { CRow, CCol, CButton, CModalBody, CModalHeader, CModal, CModalFooter } from '@coreui/react'
import { CheckboxInputField, DropdownInputField, NumberInputField, TextInputField } from '../Components'
import shortid from 'shortid'

export const InstanceEditModal = memo(forwardRef(function InstanceEditModal(_props, ref) {
	const context = useContext(CompanionContext)

	const [instanceId, setInstanceId] = useState(null)
	const [show, setShow] = useState(false)
	const [error, setError] = useState(null)
	const [reloadToken, setReloadToken] = useState(shortid())

	const [configFields, setConfigFields] = useState(null)
	const [instanceConfig, setInstanceConfig] = useState(null)
	const [validFields, setValidFields] = useState(null)

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setInstanceId(null)
		setConfigFields([])
	}, [])

	const doSave = useCallback(() => {
		setError(null)

		const isInvalid = Object.entries(validFields).filter(([k, v]) => !v)
		if (isInvalid.length > 0) {
			setError(`Some config fields are not valid: ${isInvalid.map(([k]) => k).join(', ')}`)
			return
		}

		socketEmit(context.socket, 'instance_config_put', [instanceId, instanceConfig]).then(([err, ok]) => {
			if (err) {
				if (err === 'duplicate label') {
					setError(`The label "${instanceConfig.label}" is already in use. Please use a unique name for this module instance`);
				} else {
					setError(`Unable to save instance config: "${err}"`);
				}
			} else {
				// Done
				setShow(false)
			}
		}).catch((e) => {
			setError(`Failed to save instance config: ${e}`)
		})
	},[context.socket, instanceId, validFields, instanceConfig])

	useImperativeHandle(ref, () => ({
		show(id) {
			setInstanceId(id)
			setShow(true)
		}
	}), [])

	useEffect(() => {
		if (instanceId) {
			socketEmit(context.socket, 'instance_edit', [instanceId]).then(([_instanceId, _configFields, _instanceConfig]) => {
				const validFields = {}
				for (const field of _configFields) {
					// Real validation status gets generated when the editor components first mount
					validFields[field.id] = true
				}

				setConfigFields(_configFields)
				setInstanceConfig(_instanceConfig)
				setValidFields(validFields)

			}).catch((e) => {
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

		setInstanceConfig(oldConfig => ({
			...oldConfig,
			[key]: value
		}))
	}, [])
	const setValid = useCallback((key, isValid) => {
		console.log('set valid', key, isValid)

		setValidFields(oldValid => ({
			...oldValid,
			[key]: isValid
		}))
	}, [])

	const moduleInfo = context.modules[instanceConfig?.instance_type] ?? {}
	const dataReady = instanceConfig && configFields && validFields
	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed} size="lg">
			<CModalHeader closeButton>
				<h5>{moduleInfo?.shortname ?? instanceConfig?.instance_type} Configuration</h5>
			</CModalHeader>
			<CModalBody>
				<MyErrorBoundary>
					<CRow>
						<LoadingRetryOrError error={error} dataReady={dataReady} doRetry={doRetryConfigLoad} />
						{
							instanceId && dataReady
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
							: ''
						}
					</CRow>
				</MyErrorBoundary>

			</CModalBody>
			<CModalFooter>
				<CButton
					color="secondary"
					onClick={doClose}
				>Cancel</CButton>
				<CButton
					color="primary"
					disabled={!validFields || Object.values(validFields).find(v => !v) === false}
					onClick={doSave}
				>Save</CButton>
			</CModalFooter>
		</CModal>
	)
}))

function ConfigField({ setValue, setValid, ...props}) {
	const id = props.definition.id
	const setValue2 = useCallback((val) => setValue(id, val), [setValue, id])
	const setValid2 = useCallback((valid) => setValid(id, valid), [setValid, id])

	const { definition } = props
	switch (definition.type) {
		case 'text':
			return <p title={definition.tooltip}>{definition.value}</p>
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
