import { faSearch } from '@fortawesome/free-solid-svg-icons'
import { useVirtualizer } from '@tanstack/react-virtual'
import { prepare as fuzzyPrepare } from 'fuzzysort'
import { toJS } from 'mobx'
import { observer } from 'mobx-react-lite'
import { useContext, useRef, useState } from 'react'
import type { VariableValue } from '@companion-app/shared/Model/Variables.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { usePanelCollapseHelperLite, type PanelCollapseHelperLite } from '~/Helpers/CollapseHelper.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { VariableDefinitionExt } from '~/Stores/VariablesStore.js'
import { fuzzyFilterSort } from '~/util/fuzzy.js'
import { useVariablesValuesForLabel } from '~/Variables/useVariablesValuesForLabel.js'
import { StaticAlert } from './Alert.js'
import { CopyButton } from './CopyButton.js'
import { SearchBox } from './SearchBox.js'
import { VariableValueDisplay } from './VariableValueDisplay.js'

interface VariablesTableProps {
	label: string
}

type FuzzyVariableDefinition = VariableDefinitionExt & { fuzzy: ReturnType<typeof fuzzyPrepare> }

const nameCollator = new Intl.Collator(undefined, { numeric: true })

export const VariablesTable = observer(function VariablesTable({ label }: VariablesTableProps) {
	const { variablesStore } = useContext(RootAppStoreContext)

	const [filter, setFilter] = useState('')

	const variableValues = useVariablesValuesForLabel(label)

	const panelCollapseHelper = usePanelCollapseHelperLite(
		`variables-table:${label}`,
		Array.from(variableValues.keys()),
		true
	)

	const variableDefinitions = useComputed((): FuzzyVariableDefinition[] => {
		return variablesStore.variableDefinitionsForLabel(label).map((def) => ({
			...def,
			fuzzy: fuzzyPrepare(`${def.name} ${def.description}`),
		}))
	}, [variablesStore, label])

	const [candidates, errorMsg] = useComputed(() => {
		let candidates: VariableDefinitionExt[] = []
		try {
			if (!filter) {
				candidates = variableDefinitions.sort((a, b) => nameCollator.compare(a.name, b.name))
			} else {
				candidates = fuzzyFilterSort(variableDefinitions, filter)
			}
			return [candidates, null]
		} catch (e) {
			console.error('Failed to compile candidates list:', e)

			return [null, e?.toString() || 'Unknown error']
		}
	}, [variableDefinitions, filter])

	const parentRef = useRef<HTMLDivElement | null>(null)

	const virtualizer = useVirtualizer({
		count: candidates?.length ?? 0,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 45,
		overscan: 20,
	})

	if (variableDefinitions.length === 0) {
		return (
			<StaticAlert color="warning" role="alert">
				Connection has no variables
			</StaticAlert>
		)
	}

	const totalCount = variableDefinitions.length
	const shownCount = candidates?.length ?? 0

	return (
		<>
			<SearchBox placeholder="Filter ..." filter={filter} setFilter={setFilter} className="mb-1 mt-2" />
			<p className="variables-table-count">
				{filter ? (
					<>
						Showing <strong>{shownCount}</strong> of <strong>{totalCount}</strong> variables
					</>
				) : (
					<>
						<strong>{totalCount}</strong> variables
					</>
				)}
			</p>
			<div className="variables-table-scroller" ref={parentRef}>
				<div className="variables-table-header">
					<div>Variable</div>
					<div>Value</div>
				</div>
				{errorMsg && (
					<StaticAlert color="warning" role="alert">
						Failed to build list of variables:
						<br />
						{errorMsg}
					</StaticAlert>
				)}
				{candidates?.length === 0 && !!filter && <NonIdealState icon={faSearch} text="No variables match the filter" />}
				<div
					style={{
						height: virtualizer.getTotalSize(),
						width: '100%',
						position: 'relative',
					}}
				>
					{virtualizer.getVirtualItems().map((virtualRow) => {
						const variable = candidates![virtualRow.index]
						return (
							<div
								key={virtualRow.key}
								data-index={virtualRow.index}
								ref={virtualizer.measureElement}
								style={{
									position: 'absolute',
									top: 0,
									left: 0,
									width: '100%',
									transform: `translateY(${virtualRow.start}px)`,
								}}
							>
								<VariablesTableRow
									variable={variable}
									value={variableValues.get(variable.name)}
									label={label}
									panelCollapseHelper={panelCollapseHelper}
								/>
							</div>
						)
					})}
				</div>
			</div>
		</>
	)
})

interface VariablesTableRowProps {
	variable: VariableDefinitionExt
	label: string
	value: VariableValue | undefined
	panelCollapseHelper: PanelCollapseHelperLite
}

const VariablesTableRow = observer(function VariablesTableRow({
	variable,
	value,
	label,
	panelCollapseHelper,
}: VariablesTableRowProps) {
	const variableId = `$(${label}:${variable.name})`

	return (
		<div className="variables-table-row">
			<div className="variables-table-cell">
				<div className="grid grid-col">
					<div className="flex flex-row ">
						<span className="variable-style autowrap" title={variableId}>
							{variableId}
						</span>
						<CopyButton size="sm" title="Copy variable name" text={variableId} color="primary" variant="ghost" />
					</div>
					<div className="autowrap" title={variable.description}>
						{variable.description}
					</div>
				</div>
			</div>
			<div className="variables-table-cell">
				<VariableValueDisplay
					value={toJS(value)}
					collapsePanelId={variable.name}
					panelCollapseHelper={panelCollapseHelper}
				/>
			</div>
		</div>
	)
})
