import { CCard, CCardBody, CCollapse } from '@coreui/react'
import React, { useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import type {
	UIPresetGroup,
	UIPresetGroupSimple,
	UIPresetGroupTemplate,
	UIPresetSection,
} from '@companion-app/shared/Model/Presets.js'
import { runInAction, type IObservableValue } from 'mobx'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useDrag } from 'react-dnd'
import { ButtonPreviewBase, RedImage } from '~/Components/ButtonPreview'
import { trpc } from '~/Resources/TRPC'
import type { PresetDragItem } from './PresetDragItem'
import { useResizeObserver } from 'usehooks-ts'
import { useComputed } from '~/Resources/util'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import { createStableObjectHash } from '@companion-app/shared/Util/Hash.js'

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
		runInAction(() => {
			if (expandedSection.get() === sectionId) {
				expandedSection.set(null)
			} else {
				expandedSection.set(sectionId)
			}
		})
	}, [expandedSection, sectionId])

	const cardRef = React.useRef<HTMLDivElement>(null)
	const { height = 0 } = useResizeObserver({ ref: cardRef })

	const expanded = expandedSection.get() === sectionId
	const showContent = expanded || height > 0

	const groups = Object.values(section.definitions).sort((a, b) => a.order - b.order)

	const groupComponents = groups.map((grp, i) => {
		switch (grp.type) {
			case 'simple':
				return <PresetGroupSimple key={grp.id} connectionId={connectionId} grp={grp} isFirst={i === 0} />
			case 'template':
				return <PresetGroupTemplate key={grp.id} connectionId={connectionId} grp={grp} isFirst={i === 0} />
			default:
				return null
		}
	})

	return (
		<CCard className={'add-browse-card'}>
			<div className="header" onClick={doToggleClick}>
				{section.name}
			</div>
			<CCollapse visible={expanded}>
				<CCardBody ref={cardRef}>
					{showContent && (
						<>
							{!!section.description && <div className="description mx-2 mt-1">{section.description}</div>}
							{groupComponents}
						</>
					)}
				</CCardBody>
			</CCollapse>
		</CCard>
	)
})

interface PresetGroupCustomProps {
	connectionId: string
	grp: UIPresetGroupSimple
	isFirst: boolean
}

const PresetGroupSimple = observer(function PresetGroupSimple({ connectionId, grp, isFirst }: PresetGroupCustomProps) {
	const presets = Object.values(grp.presets).sort((a, b) => a.order - b.order)

	return (
		<>
			{grp.name || grp.description ? <PresetText key={grp.id} grp={grp} /> : null}

			<div style={{ backgroundColor: '#222', borderRadius: 4, padding: 5, marginTop: !isFirst ? 10 : 0 }}>
				{presets.map((p) => (
					<PresetIconPreview
						key={p.id}
						connectionId={connectionId}
						presetId={p.id}
						title={p.label}
						variableValues={null}
					/>
				))}
			</div>
		</>
	)
})

interface PresetGroupMatrixProps {
	connectionId: string
	grp: UIPresetGroupTemplate
	isFirst: boolean
}

interface TemplateCombination {
	label: string | null
	hash: string
	values: VariableValues
}

const PresetGroupTemplate = observer(function PresetGroup({ connectionId, grp, isFirst }: PresetGroupMatrixProps) {
	const matrixCombinations = useComputed((): TemplateCombination[] => {
		if (grp.templateValues.length === 0) return []

		return grp.templateValues.map((templateValue): TemplateCombination => {
			const values: VariableValues = {
				...grp.commonVariableValues,
				[grp.templateVariableName]: templateValue.value,
			}
			return {
				label: templateValue.label,
				hash: createStableObjectHash(values),
				values,
			}
		})
	}, [grp.templateValues, grp.commonVariableValues, grp.templateVariableName])

	return (
		<>
			{grp.name || grp.description ? <PresetText key={grp.id} grp={grp} /> : null}

			<div style={{ backgroundColor: '#222', borderRadius: 4, padding: 5, marginTop: !isFirst ? 10 : 0 }}>
				{matrixCombinations.map((p) => (
					<PresetIconPreview
						key={p.hash}
						connectionId={connectionId}
						presetId={grp.definition.id}
						title={p.label || grp.definition.label}
						variableValues={p.values}
					/>
				))}
			</div>
		</>
	)
})

interface PresetTextProps {
	grp: UIPresetGroup
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
	variableValues: VariableValues | null
}
function PresetIconPreview({ connectionId, presetId, title, variableValues }: Readonly<PresetIconPreviewProps>) {
	const [, drag] = useDrag<PresetDragItem>({
		type: 'preset',
		item: {
			connectionId,
			presetId,
			variableValues: variableValues,
		},
	})

	const sub = useSubscription(
		trpc.preview.graphics.preset.subscriptionOptions(
			{
				connectionId,
				presetId,
				variableValues: variableValues,
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
