import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CButton, CButtonGroup, CCallout } from '@coreui/react'
import { SocketContext } from '~/util.js'
import { useDrag } from 'react-dnd'
import { ButtonPreviewBase, RedImage } from '~/Components/ButtonPreview.js'
import { nanoid } from 'nanoid'
import type {
	UIPresetDefinition,
	UIPresetDefinitionButton,
	UIPresetDefinitionText,
} from '@companion-app/shared/Model/Presets.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { PresetDragItem } from './PresetDragItem.js'

export interface PresetsButtonListProps {
	presets: Record<string, UIPresetDefinition>
	selectedConnectionId: string
	selectedConnectionLabel: string
	selectedCategory: string
	setConnectionAndCategory: (info: [connectionId: string | null, category: string | null]) => void
}

interface PresetButtonGroup {
	type: 'buttons'
	presets: UIPresetDefinitionButton[]
}

function groupPresetsForCategory(
	presets: Record<string, UIPresetDefinition>,
	category: string
): (PresetButtonGroup | UIPresetDefinitionText)[] {
	const filteredPresets = Object.values(presets)
		.filter((p) => p.category === category)
		.sort((a, b) => a.order - b.order)

	const result: (PresetButtonGroup | UIPresetDefinitionText)[] = []

	let currentGroup: UIPresetDefinitionButton[] = []
	for (const preset of filteredPresets) {
		if (preset.type === 'text') {
			result.push({
				type: 'buttons',
				presets: currentGroup,
			})
			currentGroup = []

			result.push(preset)
		} else {
			currentGroup.push(preset)
		}
	}

	result.push({
		type: 'buttons',
		presets: currentGroup,
	})

	return result
}

export function PresetsButtonList({
	presets,
	selectedConnectionId,
	selectedConnectionLabel,
	selectedCategory,
	setConnectionAndCategory,
}: Readonly<PresetsButtonListProps>): React.JSX.Element {
	const doBack = useCallback(
		() => setConnectionAndCategory([selectedConnectionId, null]),
		[setConnectionAndCategory, selectedConnectionId]
	)

	return (
		<div>
			<h5>Presets</h5>

			<CButtonGroup size="sm">
				<CButton color="primary" onClick={doBack}>
					<FontAwesomeIcon icon={faArrowLeft} />
					&nbsp; Go back
				</CButton>
				<CButton color="secondary" disabled>
					{selectedConnectionLabel}
				</CButton>
				<CButton color="secondary" disabled>
					{selectedCategory}
				</CButton>
			</CButtonGroup>

			{groupPresetsForCategory(presets, selectedCategory).map((preset) => {
				if (preset.type === 'text') {
					return <PresetText key={preset.id} preset={preset} />
				} else if (preset.presets.length > 0) {
					return (
						<div style={{ backgroundColor: '#222', borderRadius: 4, padding: 5, marginTop: 10 }}>
							{preset.presets.map((p) => (
								<PresetIconPreview key={p.id} connectionId={selectedConnectionId} presetId={p.id} title={p.label} />
							))}
						</div>
					)
				} else {
					return null
				}
			})}

			<br style={{ clear: 'both' }} />
			<CCallout color="info" style={{ margin: '10px 0px' }}>
				<strong>Drag and drop</strong> the preset buttons below into your buttons-configuration.
			</CCallout>
		</div>
	)
}
interface PresetTextProps {
	preset: UIPresetDefinitionText
}
function PresetText({ preset }: Readonly<PresetTextProps>) {
	return (
		<div style={{ marginTop: '10px' }}>
			<h5>{preset.label}</h5>
			<p>{preset.text}</p>
		</div>
	)
}
interface PresetIconPreviewProps {
	connectionId: string
	presetId: string
	title: string
}
function PresetIconPreview({ connectionId, presetId, title }: Readonly<PresetIconPreviewProps>) {
	const socket = useContext(SocketContext)
	const [previewImage, setPreviewImage] = useState<string | null>(null)
	const [previewError, setPreviewError] = useState(false)
	const [retryToken, setRetryToken] = useState(nanoid())

	const [, drag] = useDrag<PresetDragItem>({
		type: 'preset',
		item: {
			connectionId: connectionId,
			presetId: presetId,
		},
	})

	useEffect(() => {
		setPreviewError(false)

		socket
			.emitPromise('preview:render-preset', [connectionId, presetId])
			.then((img) => {
				setPreviewImage(img)
			})
			.catch(() => {
				console.error('Failed to preview control')
				setPreviewError(true)
			})
	}, [presetId, socket, connectionId, retryToken])

	const onClick = useCallback((isDown: boolean) => isDown && setRetryToken(nanoid()), [])

	return (
		<ButtonPreviewBase
			fixedSize
			dragRef={drag}
			title={title}
			preview={previewError ? RedImage : previewImage}
			onClick={previewError ? onClick : undefined}
		/>
	)
}
