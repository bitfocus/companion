import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CAlert, CButton, CRow } from '@coreui/react'
import {
	InstancesContext,
	LoadingRetryOrError,
	socketEmitPromise,
	applyPatchOrReplaceSubObject,
	SocketContext,
	ModulesContext,
} from '../util'
import { useDrag } from 'react-dnd'
import { ButtonPreview, dataToButtonImage, RedImage } from '../Components/ButtonPreview'
import { nanoid } from 'nanoid'

export const InstancePresets = function InstancePresets({ resetToken }) {
	const socket = useContext(SocketContext)
	const modules = useContext(ModulesContext)
	const instancesContext = useContext(InstancesContext)

	const [instanceAndCategory, setInstanceAndCategory] = useState([null, null])
	const [presetsMap, setPresetsMap] = useState(null)
	const [presetsError, setPresetError] = useState(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const doRetryPresetsLoad = useCallback(() => setReloadToken(nanoid()), [])

	// Reset selection on resetToken change
	useEffect(() => {
		setInstanceAndCategory([null, null])
	}, [resetToken])

	useEffect(() => {
		setPresetsMap(null)
		setPresetError(null)

		socketEmitPromise(socket, 'presets:subscribe', [])
			.then((data) => {
				setPresetsMap(data)
			})
			.catch((e) => {
				console.error('Failed to load presets')
				setPresetError('Failed to load presets')
			})

		const updatePresets = (id, patch) => {
			setPresetsMap((oldPresets) => applyPatchOrReplaceSubObject(oldPresets, id, patch, []))
		}

		socket.on('presets:update', updatePresets)

		return () => {
			socket.off('presets:update', updatePresets)

			socketEmitPromise(socket, 'presets:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to presets')
			})
		}
	}, [socket, reloadToken])

	if (!presetsMap) {
		// Show loading or an error
		return (
			<CRow>
				<LoadingRetryOrError error={presetsError} dataReady={presetsMap} doRetry={doRetryPresetsLoad} />
			</CRow>
		)
	}

	if (instanceAndCategory[0]) {
		const instance = instancesContext[instanceAndCategory[0]]
		const module = instance ? modules[instance.instance_type] : undefined

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
	const modules = useContext(ModulesContext)
	const instancesContext = useContext(InstancesContext)

	const options = Object.entries(presets).map(([id, vals]) => {
		if (!vals || Object.values(vals).length === 0) return ''

		const instance = instancesContext[id]
		const module = instance ? modules[instance.instance_type] : undefined

		return (
			<div key={id}>
				<CButton color="info" className="choose_instance mr-2 mb-2" onClick={() => setInstanceAndCategory([id, null])}>
					{module?.name ?? '?'} ({instance?.label ?? id})
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
				<CAlert color="info">You have no connections that support presets at the moment.</CAlert>
			) : (
				options
			)}
		</div>
	)
}

function PresetsCategoryList({ presets, instance, module, selectedInstanceId, setInstanceAndCategory }) {
	const categories = new Set()
	for (const preset of Object.values(presets)) {
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
				{module?.name ?? '?'} ({instance?.label ?? selectedInstanceId})
			</h5>

			{buttons.length === 0 ? (
				<CAlert color="primary">Connection has no presets.</CAlert>
			) : (
				<div className="preset-category-grid">{buttons}</div>
			)}
		</div>
	)
}

function PresetsButtonList({ presets, selectedInstanceId, selectedCategory, setInstanceAndCategory }) {
	const doBack = useCallback(
		() => setInstanceAndCategory([selectedInstanceId, null]),
		[setInstanceAndCategory, selectedInstanceId]
	)

	const options = Object.values(presets).filter((p) => p.category === selectedCategory)

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
	const socket = useContext(SocketContext)
	const [previewImage, setPreviewImage] = useState(null)
	const [previewError, setPreviewError] = useState(false)
	const [retryToken, setRetryToken] = useState(nanoid())

	const [, drag] = useDrag({
		type: 'preset',
		item: {
			instanceId: instanceId,
			presetId: preset.id,
		},
	})

	useEffect(() => {
		setPreviewError(false)

		socketEmitPromise(socket, 'presets:preview_render', [instanceId, preset.id])
			.then((img) => {
				setPreviewImage(img ? dataToButtonImage(img) : null)
			})
			.catch((e) => {
				console.error('Failed to preview bank')
				setPreviewError(true)
			})
	}, [preset.id, socket, instanceId, retryToken])

	const onClick = useCallback((i, isDown) => isDown && setRetryToken(nanoid()), [])

	return (
		<ButtonPreview
			fixedSize
			dragRef={drag}
			{...childProps}
			preview={previewError ? RedImage : previewImage}
			onClick={previewError ? onClick : undefined}
		/>
	)
}
