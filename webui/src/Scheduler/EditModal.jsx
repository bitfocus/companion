import React, { useCallback, useMemo, useState } from 'react'
import { CButton, CForm, CFormGroup, CInput, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { MyErrorBoundary, useMountEffect } from '../util'
import Select from 'react-select'

function getPluginSpecDefaults(pluginOptions) {
	const config = {}
	// Populate some defaults for the plugin values
	for (const spec of pluginOptions) {
		switch (spec.type) {
			case 'select':
				config[spec.key] = spec.multi ? [] : spec.choices[0]?.id
				break
			case 'textinput':
				config[spec.key] = ''
				break
			default:
				break
		}
	}

	return config
}

export function ScheduleEditModal({ doClose, doSave, item, plugins }) {
	const [config, setConfig] = useState({})
	const updateConfig = useCallback((id, val) => {
		setConfig((oldConfig) => ({
			...oldConfig,
			[id]: val,
		}))
	}, [])

	const pluginSpec = plugins?.find((p) => p.type === config.type)

	const doSaveInner = useCallback(
		(e) => {
			e.preventDefault()

			doSave(config)
			doClose()
		},
		[doClose, doSave, config]
	)

	const changeType = useCallback(
		(e) => {
			const pluginType = e.value
			const pluginSpec = plugins?.find((p) => p.type === pluginType)
			const pluginOptions = pluginSpec?.options || []

			const innerConfig = getPluginSpecDefaults(pluginOptions)
			const innerConfig2 = pluginSpec?.multiple ? [innerConfig] : innerConfig

			setConfig((oldConfig) => ({
				title: '',
				button: '',
				...oldConfig,
				type: pluginType,
				config: innerConfig2,
			}))
		},
		[plugins]
	)

	useMountEffect(() => {
		if (item) {
			const pluginSpec = plugins?.find((p) => p.type === item.type)

			// Fixup the config to be an array to make the logic simpler
			const item2 = { ...item }
			if (pluginSpec?.multiple && item2.config && !Array.isArray(item2.config)) {
				item2.config = [item2.config]
			}
			setConfig(item2)
		} else if (plugins && plugins[0]) {
			changeType({ value: plugins[0].type })
		}
	})

	const pluginChoices = useMemo(() => {
		return plugins.map((p) => ({ value: p.type, label: p.name }))
	}, [plugins])

	return (
		<CModal show={true} onClose={doClose} size="lg">
			<CForm onSubmit={doSaveInner}>
				<CModalHeader closeButton>
					<h5>Trigger Editor</h5>
				</CModalHeader>
				<CModalBody>
					<CFormGroup>
						<label>Name</label>
						<CInput required value={config.title} onChange={(e) => updateConfig('title', e.target.value)} />
					</CFormGroup>
					<CFormGroup>
						<label>Button</label>
						<CInput
							required
							value={config.button}
							onChange={(e) => updateConfig('button', e.target.value)}
							pattern="([1-9][0-9]?).([1-2][0-9]|[3][0-2]|[1-9])"
							placeholder="Button number, ex 1.1"
							title="Must be in format BANK#.BUTTON#, for example 1.1 or 99.32. Bank max is 99, button max is 32."
						/>
					</CFormGroup>
					<CFormGroup>
						<label>Type</label>
						<Select
							value={pluginChoices.find((c) => c.value === config.type)}
							onChange={changeType}
							isSearchable={false}
							isClearable={false}
							options={pluginChoices}
							required
						/>
					</CFormGroup>

					{pluginSpec?.options ? (
						<ScheduleEditModalConfig pluginSpec={pluginSpec} config={config.config} updateConfig={updateConfig} />
					) : (
						'Unknown type selected'
					)}
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Cancel
					</CButton>
					<CButton color="primary" type="submit">
						Save
					</CButton>
				</CModalFooter>
			</CForm>
		</CModal>
	)
}

function ScheduleEditModalConfig({ pluginSpec, config, updateConfig }) {
	const updateInnerConfig = useCallback(
		(id, val) => {
			updateConfig('config', {
				...config,
				[id]: val,
			})
		},
		[config, updateConfig]
	)
	const updateArrayConfig = useCallback(
		(index, id, val) => {
			const newConfig = [...config]
			newConfig[index] = {
				...newConfig[index],
				[id]: val,
			}
			updateConfig('config', newConfig)
		},
		[config, updateConfig]
	)

	const addRow = useCallback(() => {
		updateConfig('config', [...config, getPluginSpecDefaults(pluginSpec.options)])
	}, [updateConfig, config, pluginSpec])

	const delRow = (i) => {
		const config2 = [...config]
		config2.splice(i, 1)
		updateConfig('config', config2)
	}

	if (pluginSpec.multiple) {
		return (
			<>
				<table style={{ width: '100%' }}>
					<thead>
						<tr>
							{pluginSpec.options.map((spec) => (
								<th key={spec.key}>{spec.name}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{config.map((conf, i) => (
							<tr key={i}>
								<MyErrorBoundary>
									{pluginSpec.options.map((spec) => (
										<td key={spec.key}>
											<ScheduleEditModalInput
												spec={spec}
												value={conf[spec.key]}
												onChange={(val) => updateArrayConfig(i, spec.key, val)}
											/>
										</td>
									))}
								</MyErrorBoundary>
								<td>
									<CButton color="danger" onClick={() => delRow(i)} disabled={config.length <= 1}>
										X
									</CButton>
								</td>
							</tr>
						))}
					</tbody>
				</table>

				<CButton color="ghost-primary" onClick={addRow}>
					Add Additional Condition
				</CButton>
			</>
		)
	} else {
		return (
			<>
				{pluginSpec.options.map((spec) => (
					<CFormGroup key={spec.key}>
						<MyErrorBoundary>
							<ScheduleEditModalInput
								spec={spec}
								value={config[spec.key]}
								onChange={(val) => updateInnerConfig(spec.key, val)}
							/>
						</MyErrorBoundary>
					</CFormGroup>
				))}
			</>
		)
	}
}

function ScheduleEditModalInput({ spec, value, onChange }) {
	const choices = useMemo(() => {
		return spec?.choices?.map((ch) => ({ value: ch.id, label: ch.label })) ?? []
	}, [spec?.choices])

	switch (spec.type) {
		case 'textinput':
			return (
				<CInput
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={spec.placeholder}
					pattern={spec.pattern}
					required={!spec.not_required}
				/>
			)
		case 'select': {
			const selectedValue = Array.isArray(value) ? value : value === undefined ? [] : [value]
			const selectedValue2 = selectedValue.map((v) => choices.find((c) => c.value === v))
			return (
				<Select
					value={spec.multi ? selectedValue2 : selectedValue2[0]}
					onChange={(val) => onChange(spec.multi ? val?.map((v) => v.value) : val?.value)}
					isMulti={!!spec.multi}
					isClearable={false}
					isSearchable={typeof spec.minChoicesForSearch === 'number' && spec.minChoicesForSearch <= choices.length}
					options={choices}
					required
				/>
			)
		}
		default:
			return <p>Unknown input: "{spec.type}"</p>
	}
}
