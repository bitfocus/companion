import { useDraggable } from '@dnd-kit/react'
import { useSubscription } from '@trpc/tanstack-react-query'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type {
	UIPresetGroup,
	UIPresetGroupSimple,
	UIPresetGroupTemplate,
	UIPresetSection,
} from '@companion-app/shared/Model/Presets.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import { createStableObjectHash } from '@companion-app/shared/Util/Hash.js'
import { ButtonPreviewBase, RedImage } from '~/Components/ButtonPreview'
import { usePanelCollapseHelperContextForPanel } from '~/Helpers/CollapseHelper.js'
import { trpc } from '~/Resources/TRPC'
import { assertNever, useComputed } from '~/Resources/util'
import { PRESET_FEEDBACK_PLUGINS, type PresetDragItem, type PresetPlacementMode } from './PresetDragItem'
import { PresetSectionHeader } from './PresetSectionHeader.js'

interface PresetSectionCollapseProps {
	section: UIPresetSection

	connectionId: string

	/** The mode (copy/reference) newly placed presets from this connection should use */
	placementMode: PresetPlacementMode
}

export const PresetSectionCollapse = observer(function PresetButtonsCollapse({
	section,
	connectionId,
	placementMode,
}: PresetSectionCollapseProps) {
	const { isCollapsed, toggleCollapsed } = usePanelCollapseHelperContextForPanel(null, section.id)

	const groups = Object.values(section.definitions).sort((a, b) => a.order - b.order)

	const groupComponents = groups.map((grp, i) => {
		switch (grp.type) {
			case 'simple':
				return (
					<PresetGroupSimple
						key={grp.id}
						connectionId={connectionId}
						grp={grp}
						isFirst={i === 0}
						placementMode={placementMode}
					/>
				)
			case 'template':
				return (
					<PresetGroupTemplate
						key={grp.id}
						connectionId={connectionId}
						grp={grp}
						isFirst={i === 0}
						placementMode={placementMode}
					/>
				)
			default:
				assertNever(grp)
				return null
		}
	})

	return (
		<>
			<PresetSectionHeader
				name={section.name}
				description={section.description ?? null}
				isCollapsed={isCollapsed}
				toggleCollapsed={toggleCollapsed}
			/>
			{!isCollapsed && <div className="presets-section-content">{groupComponents}</div>}
		</>
	)
})

interface PresetGroupCustomProps {
	connectionId: string
	grp: UIPresetGroupSimple
	isFirst: boolean
	placementMode: PresetPlacementMode
}

const PresetGroupSimple = observer(function PresetGroupSimple({
	connectionId,
	grp,
	isFirst,
	placementMode,
}: PresetGroupCustomProps) {
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
						placementMode={placementMode}
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
	placementMode: PresetPlacementMode
}

interface TemplateCombination {
	label: string | null
	hash: string
	values: VariableValues
}

const PresetGroupTemplate = observer(function PresetGroup({
	connectionId,
	grp,
	isFirst,
	placementMode,
}: PresetGroupTemplateProps) {
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
						placementMode={placementMode}
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
	placementMode: PresetPlacementMode
}
function PresetIconPreview({
	connectionId,
	presetId,
	title,
	variableValues,
	placementMode,
}: Readonly<PresetIconPreviewProps>) {
	const dragData: PresetDragItem = {
		kind: 'connection',
		connectionId,
		presetId,
		variableValues: variableValues,
		mode: placementMode,
	}
	const dragId = `preset:${connectionId}:${presetId}:${variableValues ? createStableObjectHash(variableValues) : 'base'}`
	const { ref: drag, isDragSource } = useDraggable<PresetDragItem>({
		id: dragId,
		type: 'preset',
		data: dragData,
		plugins: PRESET_FEEDBACK_PLUGINS,
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
			className={isDragSource ? 'preset-drag-source' : undefined}
			title={title}
			preview={sub.error ? RedImage : sub.data}
			onClick={sub.error ? onClick : undefined}
		/>
	)
}
