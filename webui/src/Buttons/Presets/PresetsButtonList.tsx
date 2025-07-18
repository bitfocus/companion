import React, { useCallback } from 'react'
import { CButton, CButtonGroup, CCallout } from '@coreui/react'
import { useDrag } from 'react-dnd'
import { ButtonPreviewBase, RedImage } from '~/Components/ButtonPreview.js'
import type {
	UIPresetDefinition,
	UIPresetDefinitionButton,
	UIPresetDefinitionText,
} from '@companion-app/shared/Model/Presets.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { PresetDragItem } from './PresetDragItem.js'
import { observer } from 'mobx-react-lite'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC.js'
import { useSubscription } from '@trpc/tanstack-react-query'

export interface PresetsButtonListProps {
	presets: Map<string, UIPresetDefinition> | undefined
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
	presets: Map<string, UIPresetDefinition> | undefined,
	category: string
): (PresetButtonGroup | UIPresetDefinitionText)[] {
	const filteredPresets = Array.from(presets?.values() || [])
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

export const PresetsButtonList = observer(function PresetsButtonList({
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
})

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
	const [, drag] = useDrag<PresetDragItem>({
		type: 'preset',
		item: {
			connectionId: connectionId,
			presetId: presetId,
		},
	})

	// const query = useQuery(
	// 	trpc.preview.presets.render.queryOptions({
	// 		connectionId,
	// 		presetId,
	// 	})
	// )

	const sub = useSubscription(
		trpc.preview.graphics.preset.subscriptionOptions(
			{
				connectionId,
				presetId,
			},
			{}
		)
	)

	// const queryRefetch = query.refetch
	// const onClick = useCallback(
	// 	(isDown: boolean) => {
	// 		if (!isDown) return
	// 		queryRefetch().catch((e) => {
	// 			console.error('Error fetching preset preview:', e)
	// 		})
	// 	},
	// 	[queryRefetch]
	// )

	return (
		<ButtonPreviewBase
			fixedSize
			dragRef={drag}
			title={title}
			preview={sub.error ? RedImage : sub.data}
			// preview={query.error ? RedImage : query.data}
			// onClick={query.error ? onClick : undefined}
		/>
	)
}
