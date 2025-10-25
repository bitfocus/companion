import React, { useCallback, useContext, useState, useMemo } from 'react'
import { CAlert, CButton, CFormInput, CInputGroup } from '@coreui/react'
import { useComputed } from '~/Resources/util.js'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faTimes } from '@fortawesome/free-solid-svg-icons'
import { type CompanionVariableValue } from '@companion-module/base'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { VariableDefinitionExt } from '~/Stores/VariablesStore.js'
import { usePanelCollapseHelperLite, type PanelCollapseHelperLite } from '~/Helpers/CollapseHelper.js'
import { VariableValueDisplay } from './VariableValueDisplay.js'
import { useVariablesValuesForLabel } from '~/Variables/useVariablesValuesForLabel.js'
import { toJS } from 'mobx'

interface VariablesTableProps {
	label: string
}

export const VariablesTable = observer(function VariablesTable({ label }: VariablesTableProps) {
	const { notifier, variablesStore } = useContext(RootAppStoreContext)

	const [filter, setFilter] = useState('')

	const variableValues = useVariablesValuesForLabel(label)

	const panelCollapseHelper = usePanelCollapseHelperLite(
		`variables-table:${label}`,
		Array.from(variableValues.keys()),
		true
	)

	const variableDefinitions = useComputed(() => {
		const defs = variablesStore.variableDefinitionsForLabel(label)

		defs.sort((a, b) =>
			a.name.localeCompare(b.name, undefined, {
				numeric: true,
			})
		)

		return defs
	}, [variablesStore, label])

	const onCopied = useCallback(() => {
		notifier.current?.show(`Copied`, 'Copied to clipboard', 3000)
	}, [notifier])

	const [candidates, errorMsg] = useMemo(() => {
		let candidates: VariableDefinitionExt[] = []
		try {
			if (!filter) {
				candidates = variableDefinitions
			} else {
				const regexp = new RegExp(filter, 'i')

				candidates = variableDefinitions.filter(
					(variable) => variable.name.match(regexp) || variable.label.match(regexp)
				)
			}
			return [candidates, null]
		} catch (e) {
			console.error('Failed to compile candidates list:', e)

			return [null, e?.toString() || 'Unknown error']
		}
	}, [variableDefinitions, filter])

	const clearFilter = useCallback(() => setFilter(''), [])
	const updateFilter = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.currentTarget.value), [])

	if (variableDefinitions.length === 0) {
		return (
			<CAlert color="warning" role="alert">
				Connection has no variables
			</CAlert>
		)
	}

	return (
		<>
			<CInputGroup className="variables-table-filter">
				<CFormInput
					type="text"
					placeholder="Filter ..."
					onChange={updateFilter}
					value={filter}
					style={{ fontSize: '1.2em' }}
				/>
				<CButton color="danger" onClick={clearFilter}>
					<FontAwesomeIcon icon={faTimes} />
				</CButton>
			</CInputGroup>
			<div className="variables-table-scroller ">
				<table className="table table-responsive-sm variables-table">
					<thead>
						<tr>
							<th>Variable</th>
							<th>Value</th>
						</tr>
					</thead>
					<tbody>
						{errorMsg && (
							<tr>
								<td colSpan={2}>
									<CAlert color="warning" role="alert">
										Failed to build list of variables:
										<br />
										{errorMsg}
									</CAlert>
								</td>
							</tr>
						)}
						{candidates?.map((variable) => (
							<VariablesTableRow
								key={variable.name}
								variable={variable}
								value={variableValues.get(variable.name)}
								label={label}
								onCopied={onCopied}
								panelCollapseHelper={panelCollapseHelper}
							/>
						))}
					</tbody>
				</table>
			</div>
		</>
	)
})

interface VariablesTableRowProps {
	variable: VariableDefinitionExt
	label: string
	value: CompanionVariableValue | undefined
	onCopied: () => void
	panelCollapseHelper: PanelCollapseHelperLite
}

const VariablesTableRow = observer(function VariablesTableRow({
	variable,
	value,
	label,
	onCopied,
	panelCollapseHelper,
}: VariablesTableRowProps) {
	const variableId = `$(${label}:${variable.name})`

	return (
		<tr>
			<td>
				<div className="grid grid-col">
					<div className="flex flex-row ">
						<span className="variable-style autowrap" title={variableId}>
							{variableId}
						</span>
						<CopyToClipboard text={variableId} onCopy={onCopied}>
							<CButton size="sm" title="Copy variable name">
								<FontAwesomeIcon icon={faCopy} color="#d50215" />
							</CButton>
						</CopyToClipboard>
					</div>
					<div>{variable.label}</div>
				</div>
			</td>
			<td>
				<VariableValueDisplay
					value={toJS(value)}
					collapsePanelId={variable.name}
					panelCollapseHelper={panelCollapseHelper}
					onCopied={onCopied}
				/>
			</td>
		</tr>
	)
})
