import React, { useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { usePanelCollapseHelperContextForPanel } from '~/Helpers/CollapseHelper.js'
import type {
	UIPresetGroup,
	UIPresetGroupSimple,
	UIPresetGroupTemplate,
	UIPresetSection,
} from '@companion-app/shared/Model/Presets.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useDrag } from 'react-dnd'
import { ButtonPreviewBase, RedImage } from '~/Components/ButtonPreview'
import { trpc } from '~/Resources/TRPC'
import type { PresetDragItem } from './PresetDragItem'
import { assertNever, useComputed } from '~/Resources/util'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import { createStableObjectHash } from '@companion-app/shared/Util/Hash.js'

interface PresetSectionCollapseProps {
	section: UIPresetSection

	connectionId: string
}

export const PresetSectionCollapse = observer(function PresetButtonsCollapse({
	section,
	connectionId,
}: PresetSectionCollapseProps) {
	const { isCollapsed, toggleCollapsed } = usePanelCollapseHelperContextForPanel(null, section.id)

	const groups = Object.values(section.definitions).sort((a, b) => a.order - b.order)

	const groupComponents = groups.map((grp, i) => {
		switch (grp.type) {
			case 'simple':
				return <PresetGroupSimple key={grp.id} connectionId={connectionId} grp={grp} isFirst={i === 0} />
			case 'template':
				return <PresetGroupTemplate key={grp.id} connectionId={connectionId} grp={grp} isFirst={i === 0} />
			default:
				assertNever(grp)
				return null
		}
	})

	return (
		<>
			<div
				className="collapsible-tree-group-row presets-section-row"
				role="button"
				tabIndex={0}
				aria-expanded={!isCollapsed}
				onClick={toggleCollapsed}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault()
						toggleCollapsed()
					}
				}}
			>
				<FontAwesomeIcon icon={!isCollapsed ? faCaretDown : faCaretRight} className="collapsible-tree-caret" />
				{section.name}
				{!!section.description && <div className="presets-section-description">{section.description}</div>}
			</div>
			{!isCollapsed && <div className="presets-section-content">{groupComponents}</div>}
		</>
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

			<div className="presets-icon-grid" style={{ marginTop: !isFirst ? 10 : 0 }}>
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

interface PresetGroupTemplateProps {
	connectionId: string
	grp: UIPresetGroupTemplate
	isFirst: boolean
}

interface TemplateCombination {
	label: string | null
	hash: string
	values: VariableValues
}

const PresetGroupTemplate = observer(function PresetGroup({ connectionId, grp, isFirst }: PresetGroupTemplateProps) {
	const variableCombinations = useComputed((): TemplateCombination[] => {
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

			<div className="presets-icon-grid" style={{ marginTop: !isFirst ? 10 : 0 }}>
				{variableCombinations.map((p) => (
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
		<div className="m-2">
			<h5>{grp.name}</h5>
			{grp.description ? <p>{grp.description}</p> : null}
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
