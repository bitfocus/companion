import React, { useCallback, useContext, useMemo, useState } from 'react'
import {
	CButton,
	CButtonGroup,
	CCol,
	CForm,
	CFormGroup,
	CInput,
	CLabel,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
	CRow,
} from '@coreui/react'
import { StaticContext, MyErrorBoundary, socketEmit, useMountEffect } from '../util'
import Select from 'react-select'
import { AddFeedbackDropdown, FeedbackEditor } from '../Buttons/EditButton/FeedbackPanel'
import shortid from 'shortid'
import { ActionsPanelInner } from '../Buttons/EditButton/ActionsPanel'
import { CheckboxInputField } from '../Components'

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

function getFeedbackDefaults() {
	// This should be somewhere in the backend, but there isnt anywhere appropriate currently
	return [
		{
			id: shortid(),
			type: 'variable_value',
			instance_id: 'bitfocus-companion',
			options: {
				variable: 'internal:time_hms',
				op: 'eq',
				value: '',
			},
		},
	]
}

export function ScheduleEditModal({ doClose, doSave, item, plugins }) {
	const context = useContext(StaticContext)

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

			console.log('pluginType', pluginType)
			const innerConfig = getPluginSpecDefaults(pluginOptions)
			const innerConfig2 = pluginSpec?.multiple ? [innerConfig] : innerConfig

			setConfig((oldConfig) => ({
				title: '',
				actions: [],
				...oldConfig,
				type: pluginType,
				config: pluginType === 'feedback' ? getFeedbackDefaults() : innerConfig2,
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

			// hack
			if (!item2.actions) item2.actions = []

			setConfig(item2)
		} else if (plugins) {
			const defaultPlugin = plugins.find((p) => p.type === 'feedback') ?? plugins[0]
			changeType({ value: defaultPlugin.type })
		}
	})

	const pluginChoices = useMemo(() => {
		return plugins.map((p) => ({ value: p.type, label: p.name }))
	}, [plugins])

	const setActions = useCallback((cb) => {
		setConfig((oldConfig) => {
			const newConfig = { ...oldConfig }
			newConfig.actions = cb(oldConfig.actions || [])
			return newConfig
		})
	})

	const addActionSelect = useCallback(
		(actionType) => {
			socketEmit(context.socket, 'action_get_defaults', [actionType]).then(([action]) => {
				updateConfig('actions', [...config.actions, action])
			})
		},
		[context.socket, config, updateConfig]
	)

	return (
		<CModal show={true} onClose={doClose} size="lg">
			<CForm onSubmit={doSaveInner} className={'edit-button-panel'}>
				<CModalHeader closeButton>
					<h5>Trigger Editor</h5>
				</CModalHeader>
				<CModalBody>
					<CFormGroup>
						<label>Name</label>
						<CInput required value={config.title} onChange={(e) => updateConfig('title', e.target.value)} />
					</CFormGroup>

					<legend>Condition</legend>
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

					<hr />
					<legend>Action</legend>
					<CRow form className="button-style-form">
						<CCol className="fieldtype-checkbox" sm={2} xs={3}>
							<CButton
								color="warning"
								onMouseDown={() =>
									context.socket.emit('schedule_test_actions', config.title, config.actions, config.relative_delays)
								}
							>
								Test actions
							</CButton>
						</CCol>
						<CCol className="fieldtype-checkbox" sm={2} xs={3}>
							<CLabel>Relative Delays</CLabel>
							<p>
								<CheckboxInputField
									definition={{ default: false }}
									value={config.relative_delays ?? false}
									setValue={(e) => updateConfig('relative_delays', e)}
								/>
								&nbsp;
							</p>
						</CCol>
					</CRow>
					<ActionsPanelInner
						dragId={'triggerAction'}
						addPlaceholder="+ Add action"
						actions={config.actions || []}
						setActions={setActions}
						addAction={addActionSelect}
					/>
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
	const context = useContext(StaticContext)

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
	const updateFeedbackOptionConfig = useCallback(
		(index, id, val) => {
			const newConfig = [...config]
			console.log('set', newConfig[index].options, id, val)
			newConfig[index] = {
				...newConfig[index],
				options: {
					...newConfig[index].options,
					[id]: val,
				},
			}
			updateConfig('config', newConfig)
		},
		[config, updateConfig]
	)

	const addRow = useCallback(() => {
		updateConfig('config', [...config, getPluginSpecDefaults(pluginSpec.options)])
	}, [updateConfig, config, pluginSpec])
	const addFeedbackSelect = useCallback(
		(feedbackType) => {
			socketEmit(context.socket, 'feedback_get_defaults', [feedbackType]).then(([fb]) => {
				updateConfig('config', [...config, fb])
			})
		},
		[context.socket, config, updateConfig]
	)

	const delRow = (i) => {
		const config2 = [...config]
		config2.splice(i, 1)
		updateConfig('config', config2)
	}

	// This is a bit of a hack:
	if (pluginSpec.type === 'feedback') {
		return (
			<>
				<table className="table feedback-table">
					<tbody>
						{config.map((conf, i) => (
							<tr key={i}>
								<td>
									<MyErrorBoundary>
										<FeedbackEditor
											feedback={conf}
											setValue={(id, k, v) => updateFeedbackOptionConfig(i, k, v)}
											innerDelete={() => delRow(i)}
										/>
									</MyErrorBoundary>
								</td>
							</tr>
						))}
					</tbody>
				</table>

				<AddFeedbackDropdown onSelect={addFeedbackSelect} booleanOnly />
			</>
		)
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
