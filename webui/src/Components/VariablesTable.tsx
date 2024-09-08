import React, { useCallback, useContext, useState, useMemo, useEffect, memo } from 'react'
import { CAlert, CButton, CFormInput, CInputGroup } from '@coreui/react'
import { socketEmitPromise, useComputed } from '../util.js'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faTimes } from '@fortawesome/free-solid-svg-icons'
import { CompanionVariableValues, type CompanionVariableValue } from '@companion-module/base'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { VariableDefinitionExt } from '../Stores/VariablesStore.js'
import { PanelCollapseHelperLite, usePanelCollapseHelperLite } from '../Helpers/CollapseHelper.js'

interface VariablesTableProps {
	label: string
}

export const VariablesTable = observer(function VariablesTable({ label }: VariablesTableProps) {
	const { socket, notifier, variablesStore } = useContext(RootAppStoreContext)

	const [variableValues, setVariableValues] = useState<CompanionVariableValues>({})
	const [filter, setFilter] = useState('')

	const panelCollapseHelper = usePanelCollapseHelperLite(`variables-table:${label}`, Object.keys(variableValues), true)

	const variableDefinitions = useComputed(() => {
		const defs = variablesStore.variableDefinitionsForLabel(label)

		defs.sort((a, b) =>
			a.name.localeCompare(b.name, undefined, {
				numeric: true,
			})
		)

		return defs
	}, [variablesStore, label])

	useEffect(() => {
		if (!label) return

		const doPoll = () => {
			socketEmitPromise(socket, 'variables:instance-values', [label])
				.then((values) => {
					setVariableValues(values || {})
				})
				.catch((e) => {
					setVariableValues({})
					console.log('Failed to fetch variable values: ', e)
				})
		}

		doPoll()
		const interval = setInterval(doPoll, 1000)

		return () => {
			setVariableValues({})
			clearInterval(interval)
		}
	}, [socket, label])

	const onCopied = useCallback(() => {
		notifier.current?.show(`Copied`, 'Copied to clipboard', 5000)
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
			<table className="table table-responsive-sm variables-table">
				<thead>
					<tr>
						<th>Variable</th>
						<th>Description</th>
						<th>Value</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{errorMsg && (
						<tr>
							<td colSpan={4}>
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
							value={variableValues[variable.name]}
							label={label}
							onCopied={onCopied}
							panelCollapseHelper={panelCollapseHelper}
						/>
					))}
				</tbody>
			</table>
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
	value: valueRaw,
	label,
	onCopied,
	panelCollapseHelper,
}: VariablesTableRowProps) {
	const value = typeof valueRaw !== 'string' ? valueRaw + '' : valueRaw
	const compactValue = value.length > 100 ? `${value.substring(0, 100)}...` : value

	// Split value into the lines
	const fullElems: Array<string | JSX.Element> = []
	const linesFull = value.split('\\n')
	linesFull.forEach((l, i) => {
		fullElems.push(l)
		if (i <= linesFull.length - 1) {
			fullElems.push(<br key={i} />)
		}
	})

	// Split compactValue into the lines
	const compactElms: Array<string | JSX.Element> = []
	const lines = compactValue.split('\\n')
	lines.forEach((l, i) => {
		compactElms.push(l)
		if (i <= lines.length - 1) {
			compactElms.push(<br key={i} />)
		}
	})

	return (
		<tr>
			<td>
				<span className="variable-style">
					$({label}:{variable.name})
				</span>
				<CopyToClipboard text={`$(${label}:${variable.name})`} onCopy={onCopied}>
					<CButton size="sm" title="Copy variable name">
						<FontAwesomeIcon icon={faCopy} />
					</CButton>
				</CopyToClipboard>
			</td>
			<td>{variable.label}</td>
			<td>
				{
					/*elms === '' || elms === null || elms === undefined */ lines.length === 0 ||
					valueRaw === undefined ||
					valueRaw === null ? (
						'(empty)'
					) : (
						<code
							className="compactValue"
							data-name={`${label}:${variable.name}`}
							style={{
								backgroundColor: 'rgba(0,0,200,0.1)',
								color: 'rgba(0,0,200,1)',
								fontWeight: 'normal',
								padding: '1px 3px',
								fontSize: 14,
							}}
							title={value}
						>
							{panelCollapseHelper.isPanelCollapsed(variable.name) ? compactElms : fullElems}
						</code>
					)
				}
				{value == compactValue ? (
					''
				) : panelCollapseHelper.isPanelCollapsed(variable.name) ? (
					<a
						href="#"
						data-name={`${label}:${variable.name}`}
						onClick={() => panelCollapseHelper.setPanelCollapsed(variable.name, false)}
					>
						More
					</a>
				) : (
					<a
						href="#"
						data-name={`${label}:${variable.name}`}
						onClick={() => panelCollapseHelper.setPanelCollapsed(variable.name, true)}
					>
						Less
					</a>
				)}
			</td>
			<td>
				<CopyToClipboard text={value} onCopy={onCopied}>
					<CButton size="sm" title="Copy variable value">
						<FontAwesomeIcon icon={faCopy} />
					</CButton>
				</CopyToClipboard>
			</td>
		</tr>
	)
})
