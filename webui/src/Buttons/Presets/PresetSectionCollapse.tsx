import { CCard, CCardBody, CCollapse } from '@coreui/react'
import React, { useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import type {
	UIPresetGroup,
	UIPresetGroupCustom,
	UIPresetGroupMatrix,
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
			case 'custom':
				return <PresetGroupCustom key={grp.id} connectionId={connectionId} grp={grp} isFirst={i === 0} />
			case 'matrix':
				return <PresetGroupMatrix key={grp.id} connectionId={connectionId} grp={grp} isFirst={i === 0} />
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
							{!!section.description && <div className="description">{section.description}</div>}
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
	grp: UIPresetGroupCustom
	isFirst: boolean
}

const PresetGroupCustom = observer(function PresetGroup({ connectionId, grp, isFirst }: PresetGroupCustomProps) {
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
						matrixValues={null}
					/>
				))}
			</div>
		</>
	)
})

interface PresetGroupMatrixProps {
	connectionId: string
	grp: UIPresetGroupMatrix
	isFirst: boolean
}

interface MatrixCombination {
	hash: string
	values: VariableValues
}

const PresetGroupMatrix = observer(function PresetGroup({ connectionId, grp, isFirst }: PresetGroupMatrixProps) {
	const matrixCombinations = useComputed((): MatrixCombination[] => {
		// Build the exclusion list
		const excludeHashes = new Set<string>()
		for (const exclude of grp.matrixExclude || []) {
			const hash = createStableObjectHash(exclude)
			excludeHashes.add(hash)
		}

		// Fill in the initial ones
		const generatedHashes = new Set<string>()
		const values: MatrixCombination[] = []

		if (grp.matrix && Object.keys(grp.matrix).length > 0) {
			// Get matrix keys and their possible values
			const matrixKeys = Object.keys(grp.matrix)
			const matrixValueArrays = matrixKeys.map((key) => grp.matrix[key] || [])

			// Generate all combinations using recursive approach
			const generateCombinations = (index: number, current: VariableValues) => {
				if (index === matrixKeys.length) {
					const hash = createStableObjectHash(current)
					if (!excludeHashes.has(hash) && !generatedHashes.has(hash)) {
						generatedHashes.add(hash)
						values.push({ hash, values: { ...current } })
					}
					return
				}

				const key = matrixKeys[index]
				const possibleValues = matrixValueArrays[index]

				for (const value of possibleValues) {
					generateCombinations(index + 1, { ...current, [key]: value })
				}
			}

			generateCombinations(0, {})
		}

		// Add the includes
		for (const include of grp.matrixInclude || []) {
			const hash = createStableObjectHash(include)
			if (!generatedHashes.has(hash)) {
				generatedHashes.add(hash)
				values.push({ hash, values: include })
			}
		}

		return values
	}, [grp.matrix, grp.matrixInclude, grp.matrixExclude])

	return (
		<>
			{grp.name || grp.description ? <PresetText key={grp.id} grp={grp} /> : null}

			<div style={{ backgroundColor: '#222', borderRadius: 4, padding: 5, marginTop: !isFirst ? 10 : 0 }}>
				{matrixCombinations.map((p) => (
					<PresetIconPreview
						key={p.hash}
						connectionId={connectionId}
						presetId={grp.definition.id}
						title={grp.definition.label}
						matrixValues={p.values}
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
	matrixValues: VariableValues | null
}
function PresetIconPreview({ connectionId, presetId, title, matrixValues }: Readonly<PresetIconPreviewProps>) {
	const [, drag] = useDrag<PresetDragItem>({
		type: 'preset',
		item: {
			connectionId,
			presetId,
			matrixValues,
		},
	})

	const sub = useSubscription(
		trpc.preview.graphics.preset.subscriptionOptions(
			{
				connectionId,
				presetId,
				matrixValues,
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
