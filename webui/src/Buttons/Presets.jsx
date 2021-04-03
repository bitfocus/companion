import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CAlert, CButton, CRow } from '@coreui/react'
import { CompanionContext, LoadingRetryOrError, socketEmit } from '../util'
import { useDrag } from 'react-dnd'
import { BankPreview, dataToButtonImage, RedImage } from '../Components/BankButton'
import shortid from 'shortid'

export const InstancePresets = function InstancePresets({ resetToken }) {
	const context = useContext(CompanionContext)

	const [instanceAndCategory, setInstanceAndCategory] = useState([null, null])
	const [presetsMap, setPresetsMap] = useState(null)
	const [presetsError, setPresetError] = useState(null)
	const [reloadToken, setReloadToken] = useState(shortid())

	const doRetryPresetsLoad = useCallback(() => setReloadToken(shortid()), [])

	// Reset selection on resetToken change
	useEffect(() => {
		setInstanceAndCategory([null, null])
	}, [resetToken])

	useEffect(() => {
		setPresetsMap(null)
		setPresetError(null)

		socketEmit(context.socket, 'get_presets', [])
			.then(([data]) => {
				setPresetsMap(data)
			})
			.catch((e) => {
				console.error('Failed to load presets')
				setPresetError('Failed to load presets')
			})

		const updatePresets = (id, presets) => {
			setPresetsMap((oldPresets) => {
				if (oldPresets) {
					return {
						...oldPresets,
						[id]: presets,
					}
				} else {
					return oldPresets
				}
			})
		}
		const removePresets = (id) => {
			setPresetsMap((oldPresets) => {
				if (oldPresets) {
					const newPresets = { ...oldPresets }
					delete newPresets[id]
					return newPresets
				} else {
					return oldPresets
				}
			})
		}

		context.socket.on('presets_update', updatePresets)
		context.socket.on('presets_delete', removePresets)

		return () => {
			context.socket.off('presets_update', updatePresets)
			context.socket.off('presets_delete', removePresets)
		}
	}, [context.socket, reloadToken])

	if (!presetsMap) {
		// Show loading or an error
		return (
			<CRow>
				<LoadingRetryOrError error={presetsError} dataReady={presetsMap} doRetry={doRetryPresetsLoad} />
			</CRow>
		)
	}

	if (instanceAndCategory[0]) {
		const instance = context.instances[instanceAndCategory[0]]
		const module = instance ? context.modules[instance.instance_type] : undefined

		const presets = presetsMap[instanceAndCategory[0]] ?? []

		if (instanceAndCategory[1]) {
			return (
				<PresetsButtonList
					presets={presets}
					selectedInstanceId={instanceAndCategory[0]}
					selectedCategory={instanceAndCategory[1]}
					setInstanceAndCategory={setInstanceAndCategory}
				/>
			)
		} else {
			return (
				<PresetsCategoryList
					presets={presets}
					instance={instance}
					module={module}
					selectedInstanceId={instanceAndCategory[0]}
					setInstanceAndCategory={setInstanceAndCategory}
				/>
			)
		}
	} else {
		return <PresetsInstanceList presets={presetsMap} setInstanceAndCategory={setInstanceAndCategory} />
	}
}

function PresetsInstanceList({ presets, setInstanceAndCategory }) {
	const context = useContext(CompanionContext)

	const options = Object.keys(presets).map((id) => {
		const instance = context.instances[id]
		const module = instance ? context.modules[instance.instance_type] : undefined

		return (
			<div key={id}>
				<CButton color="info" className="choose_instance mr-2 mb-2" onClick={() => setInstanceAndCategory([id, null])}>
					{module?.label ?? '?'} ({instance?.label ?? id})
				</CButton>
			</div>
		)
	})

	return (
		<div>
			<h5>Presets</h5>
			<p>
				Some connections support something we call presets, it's ready made buttons with text, actions and feedback so
				you don't need to spend time making everything from scratch. They can be drag and dropped onto your button
				layout.
			</p>
			{options.length === 0 ? (
				<CAlert color="info">You have no instances that support presets at the moment.</CAlert>
			) : (
				options
			)}
		</div>
	)
}

function PresetsCategoryList({ presets, instance, module, selectedInstanceId, setInstanceAndCategory }) {
	const categories = new Set()
	for (const preset of presets) {
		categories.add(preset.category)
	}

	const doBack = useCallback(() => setInstanceAndCategory([null, null]), [setInstanceAndCategory])

	const buttons = Array.from(categories).map((category) => {
		return (
			<CButton key={category} color="info" block onClick={() => setInstanceAndCategory([selectedInstanceId, category])}>
				{category}
			</CButton>
		)
	})

	return (
		<div>
			<h5>
				<CButton color="primary" size="sm" onClick={doBack}>
					Back
				</CButton>
				{module?.label ?? '?'} ({instance?.label ?? selectedInstanceId})
			</h5>

			{buttons.length === 0 ? (
				<CAlert color="primary">Instance has no presets.</CAlert>
			) : (
				<div className="preset-category-grid">{buttons}</div>
			)}
		</div>
	)
}

function PresetsButtonList({ presets, selectedInstanceId, selectedCategory, setInstanceAndCategory }) {
	const doBack = useCallback(() => setInstanceAndCategory([selectedInstanceId, null]), [
		setInstanceAndCategory,
		selectedInstanceId,
	])

	const options = presets.filter((p) => p.category === selectedCategory)

	return (
		<div>
			<h5>
				<CButton color="primary" size="sm" onClick={doBack}>
					Back
				</CButton>
				{selectedCategory}
			</h5>
			<p>Drag and drop the preset buttons below into your buttons-configuration.</p>

			{options.map((preset, i) => {
				return (
					<PresetIconPreview
						key={i}
						instanceId={selectedInstanceId}
						preset={preset}
						alt={preset.label}
						title={preset.label}
					/>
				)
			})}

			<br style={{ clear: 'both' }} />
		</div>
	)
}

function PresetIconPreview({ preset, instanceId, ...childProps }) {
	const context = useContext(CompanionContext)
	const [previewImage, setPreviewImage] = useState(null)
	const [previewError, setPreviewError] = useState(false)
	const [retryToken, setRetryToken] = useState(shortid())

	const [, drag] = useDrag({
		item: {
			type: 'preset',
			instanceId: instanceId,
			preset: preset,
		},
	})

	useEffect(() => {
		setPreviewError(false)

		socketEmit(context.socket, 'graphics_preview_generate', [preset.bank])
			.then(([img]) => {
				setPreviewImage(dataToButtonImage(img))
			})
			.catch((e) => {
				console.error('Failed to preview bank')
				setPreviewError(true)
			})
	}, [preset.bank, context.socket, retryToken])

	const onClick = useCallback((i, isDown) => isDown && setRetryToken(shortid()), [])

	return (
		<BankPreview
			fixedSize
			dragRef={drag}
			{...childProps}
			preview={previewError ? RedImage : previewImage}
			onClick={previewError ? onClick : undefined}
		/>
	)
}
