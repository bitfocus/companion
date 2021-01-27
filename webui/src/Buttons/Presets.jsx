import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CAlert, CButton } from '@coreui/react'
import { CompanionContext, socketEmit } from '../util'
import { useDrag } from 'react-dnd'
import { BankPreview, dataToButtonImage } from '../Components/BankButton'

export function InstancePresets({ resetToken }) {
	const context = useContext(CompanionContext)

	const [instanceAndCategory, setInstanceAndCategory] = useState([null, null])
	const [presetsMap, setPresetsMap] = useState({})

	// Reset selection on resetToken change
	useEffect(() => {
		setInstanceAndCategory([null, null])
	}, [resetToken])

	useEffect(() => {

		socketEmit(context.socket, 'get_presets', []).then(([data]) => {
			setPresetsMap(data)
		}).catch((e) => {
			console.error('Failed to load presets')
		})

		const updatePresets = (id, presets) => {
			setPresetsMap(oldPresets => ({
				...oldPresets,
				[id]: presets,
			}))
		}
		const removePresets = (id) => {
			setPresetsMap(oldPresets => {
				const newPresets = { ...oldPresets }
				delete newPresets[id]
				return newPresets
			})
		}

		context.socket.on('presets_update', updatePresets)
		context.socket.on('presets_delete', removePresets)

		return () => {
			context.socket.off('presets_update', updatePresets)
			context.socket.off('presets_delete', removePresets)
		}
	}, [context.socket])

	if (instanceAndCategory[0]) {
		const instance = context.instances[instanceAndCategory[0]]
		const module = instance ? context.modules[instance.instance_type] : undefined

		const presets = presetsMap[instanceAndCategory[0]] ?? []

		if (instanceAndCategory[1]) {
			return <PresetsButtonList presets={presets} selectedInstanceId={instanceAndCategory[0]} selectedCategory={instanceAndCategory[1]} setInstanceAndCategory={setInstanceAndCategory} />
		} else {
			return <PresetsCategoryList presets={presets} instance={instance} module={module} selectedInstanceId={instanceAndCategory[0]} setInstanceAndCategory={setInstanceAndCategory} />
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

		return <div key={id}>
			<CButton color='primary' className="choose_instance" onClick={() => setInstanceAndCategory([id, null])}>
				{module?.label ?? '?'} ({instance?.label ?? id})
			</CButton>
			<br /><br />
		</div>
	})

	return <div>
		<h4>Available instance presets</h4>

		{
			options.length === 0
				? <CAlert color='primary'>You have no instances that support presets at the moment. More modules will support presets in the future.</CAlert>
				: options
		}
	</div>
}

function PresetsCategoryList({ presets, instance, module, selectedInstanceId, setInstanceAndCategory }) {
	const categories = new Set()
	for (const preset of presets) {
		categories.add(preset.category)
	}

	const doBack = useCallback(() => setInstanceAndCategory([null, null]), [setInstanceAndCategory])

	const buttons = Array.from(categories).map((category) => {
		return <CButton key={category} color="primary" block onClick={() => setInstanceAndCategory([selectedInstanceId, category])}>{category}</CButton>
	})

	return <div>
		<h4>
			<CButton color='primary' size="sm" onClick={doBack}>Back</CButton>
			Preset categories for  {module?.label ?? '?'} ({instance?.label ?? selectedInstanceId})
		</h4>

		{
			buttons.length === 0
				? <CAlert color='primary'>Instance has no presets.</CAlert>
				: <div className="preset-category-grid">
					{buttons}
				</div>
		}
	</div>
}

function PresetsButtonList({ presets, selectedInstanceId, selectedCategory, setInstanceAndCategory }) {
	const doBack = useCallback(() => setInstanceAndCategory([selectedInstanceId, null]), [setInstanceAndCategory, selectedInstanceId])

	const options = presets.filter(p => p.category === selectedCategory)

	return <div>
		<h4>
			<CButton color='primary' size="sm" onClick={doBack}>Back</CButton>
			Presets for {selectedCategory}
		</h4>
		<p>Drag and drop the preset buttons below into your buttons-configuration.</p>

		{
			options.map((preset, i) => {
				return <PresetIconPreview key={i} instanceId={selectedInstanceId} preset={preset} alt={preset.label} />
			})
		}

		<br style={{ clear: 'both' }} />
	</div>
}

function PresetIconPreview({ preset, instanceId, ...childProps }) {
	const context = useContext(CompanionContext)
	const [previewImage, setPreviewImage] = useState(null)

	const [, drag] = useDrag({
		item: {
			type: 'preset',
			instanceId: instanceId,
			preset: preset,
		},
	})

	useEffect(() => {
		socketEmit(context.socket, 'graphics_preview_generate', [preset.bank]).then(([img]) => {
			setPreviewImage(dataToButtonImage(img))
		}).catch(e => {
			console.error('Failed to preview bank')
		})
	}, [preset.bank, context.socket])

	return (
		<BankPreview fixedSize dragRef={drag} {...childProps} preview={previewImage} />
	)
}
