import React, { memo, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
	CButton,
	CForm,
	CFormGroup,
	CInput,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
	CSelect,
} from '@coreui/react'
import { CompanionContext, MyErrorBoundary, useMountEffect } from './util'
import dayjs from 'dayjs'
import Select from 'react-select'
import { BankPreview, dataToButtonImage } from './Components/BankButton'

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

export const Scheduler = memo(function Scheduler() {
	const context = useContext(CompanionContext)

	const [plugins, setPlugins] = useState(null)
	const [scheduleList, setScheduleList] = useState(null)
	const [editItem, setEditItem] = useState([false, null])

	const loadSchedule = useCallback((list) => {
		setScheduleList(list)
	}, [])

	const replaceItem = useCallback((itemId, item) => {
		setScheduleList((list) => {
			const newList = [...list]
			const index = newList.findIndex((i) => i.id === itemId)
			if (index !== -1) {
				if (item) {
					newList[index] = item
				} else {
					newList.splice(index, 1)
				}
			} else if (item) {
				newList.push(item)
			}
			return newList
		})
	}, [])

	const doEditItem = useCallback((itemId) => setEditItem([true, itemId]), [])
	const doAddNew = useCallback(() => setEditItem([true, null]), [])
	const doCloseModal = useCallback(() => setEditItem([false, null]), [])

	const doSave = useCallback(
		(newConfig) => {
			console.log('save item', newConfig)
			context.socket.emit('schedule_save_item', newConfig, (clean) => {
				replaceItem(clean.id, clean)
			})
		},
		[context.socket, replaceItem]
	)

	// on mount, load the plugins
	useEffect(() => {
		context.socket.emit('schedule_plugins', (newPlugins) => {
			setPlugins(newPlugins)
		})
		context.socket.emit('schedule_get', loadSchedule)
		context.socket.on('schedule_refresh', loadSchedule)

		return () => {
			context.socket.off('schedule_refresh', loadSchedule)
		}
	}, [context.socket, loadSchedule])

	return (
		<div>
			<h4>Triggers and schedules</h4>
			<p>This allows you to recall buttons based on variables or time-based events.</p>

			{editItem[0] ? (
				<ScheduleEditModal
					item={editItem[1] !== null ? scheduleList.find((i) => i.id === editItem[1]) : undefined}
					doClose={doCloseModal}
					plugins={plugins}
					doSave={doSave}
				/>
			) : (
				''
			)}

			<ScheduleTable scheduleList={scheduleList} replaceItem={replaceItem} editItem={doEditItem} />

			<CButton color="primary" onClick={doAddNew}>
				Add New Trigger
			</CButton>
		</div>
	)
})

function ScheduleEditModal({ doClose, doSave, item, plugins }) {
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
			const pluginType = typeof e === 'string' ? e : e.target.value
			const pluginSpec = plugins?.find((p) => p.type === pluginType)?.options || []

			const innerConfig = getPluginSpecDefaults(pluginSpec)
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
		} else if (plugins[0]) {
			changeType(plugins[0].type)
		}
	})

	return (
		<CModal show={true} onClose={doClose}>
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
						<CSelect required value={config.type} onChange={changeType}>
							{plugins.map((p) => (
								<option key={p.type} value={p.type}>
									{p.name}
								</option>
							))}
						</CSelect>
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
				<table>
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
									{config.length > 1 ? (
										<CButton color="danger" onClick={() => delRow(i)}>
											X
										</CButton>
									) : (
										''
									)}
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
					options={choices}
					required
				/>
			)
		}
		default:
			return <p>Unknown input: "{spec.type}"</p>
	}
}
const tableDateFormat = 'MM/DD HH:mm:ss'
function ScheduleTable({ scheduleList, replaceItem, editItem }) {
	const context = useContext(CompanionContext)

	const [previewImages, setPreviewImages] = useState({})
	const [subscribedImages, setSubscribedImages] = useState([])

	useMountEffect(() => {
		const updateImage = (p, b, img) => {
			const id = `${p}.${b}`
			setPreviewImages((oldImages) => ({
				...oldImages,
				[id]: dataToButtonImage(img),
			}))
		}
		context.socket.on('schedule_preview_data', updateImage)

		return () => {
			context.socket.off('schedule_preview_data', updateImage)

			// unsubscribe all
			for (const id of subscribedImages) {
				const [page, bank] = id.split('.')
				context.socket.emit('scheduler_bank_preview', page, bank, true)
			}
		}
	})

	useEffect(() => {
		setSubscribedImages((oldSubs) => {
			const currentSubs = new Set(oldSubs)
			const newSubs = new Set()

			for (const item of scheduleList ?? []) {
				// Subscribe if new
				if (!currentSubs.has(item.button) && !newSubs.has(item.button)) {
					const [page, bank] = item.button.split('.')
					context.socket.emit('scheduler_bank_preview', page, bank)
				}

				newSubs.add(item.button)
			}

			// Unsubscribe old
			for (const oldSub of Array.from(currentSubs)) {
				if (!newSubs.has(oldSub)) {
					const [page, bank] = oldSub.split('.')
					context.socket.emit('scheduler_bank_preview', page, bank, true)
				}
			}

			return Array.from(newSubs)
		})
	}, [context.socket, scheduleList])

	useEffect(() => {
		setPreviewImages((oldImages) => {
			const newImages = {}

			for (const sub of subscribedImages) {
				newImages[sub] = oldImages[sub]
			}

			return newImages
		})
	}, [subscribedImages])

	return (
		<table className="table table-responsive-sm">
			<thead>
				<tr>
					<th>Name</th>
					<th>Trigger</th>
					<th>Button</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{scheduleList && scheduleList.length > 0 ? (
					scheduleList.map((item) => (
						<ScheduleTableRow
							key={item.id}
							item={item}
							replaceItem={replaceItem}
							editItem={editItem}
							image={previewImages[item.button]}
						/>
					))
				) : (
					<tr>
						<td colSpan="4">There currently are no events scheduled.</td>
					</tr>
				)}
			</tbody>
		</table>
	)
}
function ScheduleTableRow({ item, replaceItem, editItem, image }) {
	const context = useContext(CompanionContext)

	const doEnableDisable = useCallback(() => {
		context.socket.emit('schedule_update_item', item.id, { disabled: !item.disabled }, (clean) => {
			console.log('completed disable', clean)
			replaceItem(clean.id, clean)
		})
	}, [context.socket, replaceItem, item.id, item.disabled])
	const doDelete = useCallback(() => {
		context.socket.emit('schedule_update_item', item.id, { deleted: true }, () => {
			console.log('completed delete', item.id)
			replaceItem(item.id, null)
		})
	}, [context.socket, replaceItem, item.id])
	const doEdit = useCallback(() => {
		editItem(item.id)
	}, [editItem, item.id])

	return (
		<tr>
			<td>{item.title}</td>
			<td>
				{/* TODO - can we remove the dangerous html markup here? */}
				<div dangerouslySetInnerHTML={{ __html: item.config_desc }} />
				<br />
				{item.last_run ? <small>Last run: {dayjs(item.last_run).format(tableDateFormat)}</small> : ''}
			</td>
			<td>
				<BankPreview fixedSize preview={image} />
			</td>
			<td className="action-buttons">
				<CButton size="sm" color="ghost-danger" onClick={doDelete}>
					delete
				</CButton>
				{item.disabled ? (
					<CButton size="sm" color="ghost-success" onClick={doEnableDisable}>
						enable
					</CButton>
				) : (
					<CButton size="sm" color="ghost-warning" onClick={doEnableDisable}>
						disable
					</CButton>
				)}
				<CButton size="sm" color="primary" onClick={doEdit}>
					edit
				</CButton>
			</td>
		</tr>
	)
}
