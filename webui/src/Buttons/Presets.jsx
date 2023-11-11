import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CAlert, CButton, CRow } from '@coreui/react'
import {
	ConnectionsContext,
	LoadingRetryOrError,
	socketEmitPromise,
	applyPatchOrReplaceSubObject,
	SocketContext,
	ModulesContext,
} from '../util'
import { useDrag } from 'react-dnd'
import { ButtonPreview, RedImage } from '../Components/ButtonPreview'
import { nanoid } from 'nanoid'

export const InstancePresets = function InstancePresets({ resetToken }) {
	const socket = useContext(SocketContext)
	const modules = useContext(ModulesContext)
	const connectionsContext = useContext(ConnectionsContext)

	const [connectionAndCategory, setConnectionAndCategory] = useState([null, null])
	const [presetsMap, setPresetsMap] = useState(null)
	const [presetsError, setPresetError] = useState(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const doRetryPresetsLoad = useCallback(() => setReloadToken(nanoid()), [])

	// Reset selection on resetToken change
	useEffect(() => {
		setConnectionAndCategory([null, null])
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

	if (connectionAndCategory[0]) {
		const connectionInfo = connectionsContext[connectionAndCategory[0]]
		const moduleInfo = connectionInfo ? modules[connectionInfo.instance_type] : undefined

		const presets = presetsMap[connectionAndCategory[0]] ?? []

		if (connectionAndCategory[1]) {
			return (
				<PresetsButtonList
					presets={presets}
					selectedConnectionId={connectionAndCategory[0]}
					selectedCategory={connectionAndCategory[1]}
					setConnectionAndCategory={setConnectionAndCategory}
				/>
			)
		} else {
			return (
				<PresetsCategoryList
					presets={presets}
					connectionInfo={connectionInfo}
					moduleInfo={moduleInfo}
					selectedConnectionId={connectionAndCategory[0]}
					setConnectionAndCategory={setConnectionAndCategory}
				/>
			)
		}
	} else {
		return <PresetsConnectionList presets={presetsMap} setConnectionAndCategory={setConnectionAndCategory} />
	}
}

function PresetsConnectionList({ presets, setConnectionAndCategory }) {
	const modules = useContext(ModulesContext)
	const connectionsContext = useContext(ConnectionsContext)

	const options = Object.entries(presets).map(([id, vals]) => {
		if (!vals || Object.values(vals).length === 0) return ''

		const connectionInfo = connectionsContext[id]
		const moduleInfo = connectionInfo ? modules[connectionInfo.instance_type] : undefined

		return (
			<div key={id}>
				<CButton
					color="danger"
					className="choose_connection mr-2 mb-2"
					onClick={() => setConnectionAndCategory([id, null])}
				>
					{moduleInfo?.name ?? '?'} ({connectionInfo?.label ?? id})
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

function PresetsCategoryList({ presets, connectionInfo, moduleInfo, selectedConnectionId, setConnectionAndCategory }) {
	const categories = new Set()
	for (const preset of Object.values(presets)) {
		categories.add(preset.category)
	}

	const doBack = useCallback(() => setConnectionAndCategory([null, null]), [setConnectionAndCategory])

	const buttons = Array.from(categories).map((category) => {
		return (
			<CButton
				key={category}
				color="danger"
				block
				onClick={() => setConnectionAndCategory([selectedConnectionId, category])}
			>
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
				{moduleInfo?.name ?? '?'} ({connectionInfo?.label ?? selectedConnectionId})
			</h5>

			{buttons.length === 0 ? (
				<CAlert color="primary">Connection has no presets.</CAlert>
			) : (
				<div className="preset-category-grid">{buttons}</div>
			)}
		</div>
	)
}

function PresetsButtonList({ presets, selectedConnectionId, selectedCategory, setConnectionAndCategory }) {
	const doBack = useCallback(
		() => setConnectionAndCategory([selectedConnectionId, null]),
		[setConnectionAndCategory, selectedConnectionId]
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
						connectionId={selectedConnectionId}
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

function PresetIconPreview({ preset, connectionId, ...childProps }) {
	const socket = useContext(SocketContext)
	const [previewImage, setPreviewImage] = useState(null)
	const [previewError, setPreviewError] = useState(false)
	const [retryToken, setRetryToken] = useState(nanoid())

	const [, drag] = useDrag({
		type: 'preset',
		item: {
			connectionId: connectionId,
			presetId: preset.id,
		},
	})

	useEffect(() => {
		setPreviewError(false)

		socketEmitPromise(socket, 'presets:preview_render', [connectionId, preset.id])
			.then((img) => {
				setPreviewImage(img)
			})
			.catch((e) => {
				console.error('Failed to preview bank')
				setPreviewError(true)
			})
	}, [preset.id, socket, connectionId, retryToken])

	const onClick = useCallback((_location, isDown) => isDown && setRetryToken(nanoid()), [])

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
