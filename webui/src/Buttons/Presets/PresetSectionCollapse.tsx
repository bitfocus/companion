import { CCard, CCardBody, CCollapse } from '@coreui/react'
import React, { useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import type { UIPresetGroupCustom, UIPresetSection } from '@companion-app/shared/Model/Presets.js'
import type { IObservableValue } from 'mobx'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useDrag } from 'react-dnd'
import { ButtonPreviewBase, RedImage } from '~/Components/ButtonPreview'
import { trpc } from '~/Resources/TRPC'
import type { PresetDragItem } from './PresetDragItem'
import { useResizeObserver } from 'usehooks-ts'

interface PresetSectionCollapseProps {
	section: UIPresetSection

	connectionId: string

	expandedSection: IObservableValue<string | null>
}

export const PresetSectionCollapse = observer(function PresetButtonsCollapse({
	section,
	connectionId,
	expandedSection,
}: PresetSectionCollapseProps) {
	const sectionId = section.id
	const doToggleClick = useCallback(() => {
		if (expandedSection.get() === sectionId) {
			expandedSection.set(null)
		} else {
			expandedSection.set(sectionId)
		}
	}, [expandedSection, sectionId])

	const cardRef = React.useRef<HTMLDivElement>(null)
	const { height = 0 } = useResizeObserver({ ref: cardRef })

	// const grouped = groupPresetsForCategory(presets, category)
	// if (grouped.length === 0) {
	// 	// Hide card if there are no presets which match
	// 	return null
	// }

	const expanded = expandedSection.get() === sectionId
	const showContent = expanded || height > 0

	return (
		<CCard className={'add-browse-card'}>
			<div className="header" onClick={doToggleClick}>
				{section.name}
			</div>
			<CCollapse visible={expanded}>
				<CCardBody ref={cardRef}>
					{showContent && (
						<>
							{!!section.description && <div className="description">{section.description}</div>}

							{Object.values(section.definitions).map((grp, i) => {
								return <PresetGroup key={grp.id} connectionId={connectionId} grp={grp} isFirst={i === 0} />
							})}
						</>
					)}
				</CCardBody>
			</CCollapse>
		</CCard>
	)
})

interface PresetGroupProps {
	connectionId: string
	grp: UIPresetGroupCustom
	isFirst: boolean
}

const PresetGroup = observer(function PresetGroup({ connectionId, grp, isFirst }: PresetGroupProps) {
	const presets = Object.values(grp.presets).sort((a, b) => a.order - b.order)

	return (
		<>
			{grp.name || grp.description ? <PresetText key={grp.id} grp={grp} /> : null}

			{presets.length > 0 && (
				<div style={{ backgroundColor: '#222', borderRadius: 4, padding: 5, marginTop: !isFirst ? 10 : 0 }}>
					{presets.map((p) => (
						<PresetIconPreview key={p.id} connectionId={connectionId} presetId={p.id} title={p.label} />
					))}
				</div>
			)}
		</>
	)
})

interface PresetTextProps {
	grp: UIPresetGroupCustom
}
function PresetText({ grp }: Readonly<PresetTextProps>) {
	return (
		<div className="mx-2 mt-2">
			<h5>{grp.name}</h5>
			<p>{grp.description}</p>
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
