import { CCard, CCardBody, CCollapse } from '@coreui/react'
import React, { useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import type {
	UIPresetDefinition,
	UIPresetDefinitionButton,
	UIPresetDefinitionText,
} from '@companion-app/shared/Model/Presets.js'
import type { IObservableValue } from 'mobx'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useDrag } from 'react-dnd'
import { ButtonPreviewBase, RedImage } from '~/Components/ButtonPreview'
import { trpc } from '~/Resources/TRPC'
import type { PresetDragItem } from './PresetDragItem'
import { useResizeObserver } from 'usehooks-ts'

interface PresetButtonsCollapseProps {
	presets: Map<string, UIPresetDefinition> | undefined
	category: string

	connectionId: string

	expandedCategory: IObservableValue<string | null>
}

export const PresetButtonsCollapse = observer(function PresetButtonsCollapse({
	presets,
	category,
	connectionId,
	expandedCategory,
}: PresetButtonsCollapseProps) {
	const doToggleClick = useCallback(() => {
		if (expandedCategory.get() === category) {
			expandedCategory.set(null)
		} else {
			expandedCategory.set(category)
		}
	}, [expandedCategory, category])

	const cardRef = React.useRef<HTMLDivElement>(null)
	const { height = 0 } = useResizeObserver({ ref: cardRef })

	const grouped = groupPresetsForCategory(presets, category)
	if (grouped.length === 0) {
		// Hide card if there are no presets which match
		return null
	}

	const expanded = expandedCategory.get() === category
	const showContent = expanded || height > 0

	return (
		<CCard className={'add-browse-card'}>
			<div className="header" onClick={doToggleClick}>
				{category}
			</div>
			<CCollapse visible={expanded}>
				<CCardBody ref={cardRef}>
					{showContent &&
						grouped.map((preset, i) => {
							if (preset.type === 'text') {
								return <PresetText key={preset.id} preset={preset} />
							} else if (preset.presets.length > 0) {
								return (
									<div style={{ backgroundColor: '#222', borderRadius: 4, padding: 5, marginTop: i > 0 ? 10 : 0 }}>
										{preset.presets.map((p) => (
											<PresetIconPreview key={p.id} connectionId={connectionId} presetId={p.id} title={p.label} />
										))}
									</div>
								)
							} else {
								return null
							}
						})}
				</CCardBody>
			</CCollapse>
		</CCard>
	)
})

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

	if (currentGroup.length > 0) {
		result.push({
			type: 'buttons',
			presets: currentGroup,
		})
	}

	return result
}

interface PresetTextProps {
	preset: UIPresetDefinitionText
}
function PresetText({ preset }: Readonly<PresetTextProps>) {
	return (
		<div className="mx-2 mt-2">
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

	const sub = useSubscription(
		trpc.preview.graphics.preset.subscriptionOptions(
			{
				connectionId,
				presetId,
			},
			{}
		)
	)

	const queryRefetch = sub.reset
	const onClick = useCallback(
		(isDown: boolean) => {
			if (!isDown) return
			queryRefetch()
		},
		[queryRefetch]
	)

	return (
		<ButtonPreviewBase
			fixedSize
			dragRef={drag}
			title={title}
			preview={sub.error ? RedImage : sub.data}
			onClick={sub.error ? onClick : undefined}
		/>
	)
}
