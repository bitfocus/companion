import React, { useCallback, useContext, useState, useMemo, useEffect } from 'react'
import { CAlert, CButton, CFormInput, CInputGroup } from '@coreui/react'
import { useComputed } from '../util.js'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faTimes } from '@fortawesome/free-solid-svg-icons'
import { CompanionVariableValues, type CompanionVariableValue } from '@companion-module/base'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { VariableDefinitionExt } from '../Stores/VariablesStore.js'
import { PanelCollapseHelperLite, usePanelCollapseHelperLite } from '../Helpers/CollapseHelper.js'
import { VariableTypeIcon } from './VariableTypeIcon.js'

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
			socket
				.emitPromise('variables:connection-values', [label])
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
			<div className="variables-table-scroller ">
				<table className="table table-responsive-sm variables-table variables-table-max-33">
					<thead>
						<tr>
							<th>Variable</th>
							<th>Description</th>
							<th>Value</th>
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
	value: valueRaw,
	label,
	onCopied,
	panelCollapseHelper,
}: VariablesTableRowProps) {
	const value = typeof valueRaw !== 'string' ? JSON.stringify(valueRaw, undefined, '\t') || '' : valueRaw
	const compactValue = value.length > 100 ? `${value.substring(0, 100)}...` : value

	console.log('value', value, compactValue)

	// Split display value into the lines
	const displayValue = panelCollapseHelper.isPanelCollapsed(variable.name) ? compactValue : value
	const elms: Array<string | JSX.Element> = []
	const lines = displayValue.split('\\n')
	lines.forEach((l, i) => {
		elms.push(l)
		if (i <= lines.length - 2) {
			elms.push(<br key={i} />)
		}
	})

	let typeDescription = 'unknown'
	let iconPath = 'unknown'
	if (typeof valueRaw === 'string') {
		iconPath = 'string'
		typeDescription = 'Text string'
	} else if (valueRaw === undefined) {
		iconPath = 'undefined'
		typeDescription = 'Undefined'
	} else if (valueRaw === null) {
		iconPath = 'null'
		typeDescription = 'Null'
	} else if (typeof valueRaw === 'number' && isNaN(valueRaw)) {
		iconPath = 'NaN'
		typeDescription = 'Not a Number'
	} else if (typeof valueRaw === 'number') {
		iconPath = 'number'
		typeDescription = 'Numeric value'
	} else if (typeof valueRaw === 'boolean') {
		iconPath = 'boolean'
		typeDescription = 'Boolean value'
	} else if (typeof valueRaw === 'object') {
		iconPath = 'object'
		typeDescription = 'JSON Object or Array'
	}

	return (
		<tr>
			<td>
				<span className="variable-style">
					$({label}:{variable.name})
				</span>
				<CopyToClipboard text={`$(${label}:${variable.name})`} onCopy={onCopied}>
					<CButton size="sm" title="Copy variable name">
						<FontAwesomeIcon icon={faCopy} color="#d50215" />
					</CButton>
				</CopyToClipboard>
			</td>
			<td>{variable.label}</td>
			<td>
				{
					/*elms === '' || elms === null || elms === undefined */ lines.length === 0 ? (
						'(empty)'
					) : (
						<div
							style={{
								display: 'inline',
							}}
						>
							<span
								style={{
									backgroundColor: 'rgba(0,0,200,1)',
									borderRadius: '6px 0 0 6px',
									padding: '4px',
									height: '24px',
									display: 'inline-block',
									lineHeight: '14px',
								}}
								title={`Variable type: ${typeDescription}`}
							>
								<VariableTypeIcon
									width={12}
									height={12}
									icon={iconPath}
									fill="#ffffff"
									style={{ verticalAlign: '-1px' }}
								/>
							</span>
							<code
								style={{
									backgroundColor: 'rgba(0,0,200,0.1)',
									color: 'rgba(0,0,200,1)',
									padding: '4px',
									borderRadius: '0 6px 6px 0',
									fontSize: 14,
									fontWeight: 'normal',
									lineHeight: '2em',
								}}
								title={value}
							>
								{elms}
							</code>

							<CopyToClipboard text={value} onCopy={onCopied}>
								<CButton size="sm" title="Copy variable value">
									<FontAwesomeIcon icon={faCopy} color="rgba(0,0,200,1)" />
								</CButton>
							</CopyToClipboard>
						</div>
					)
				}
				{value == compactValue ? (
					''
				) : panelCollapseHelper.isPanelCollapsed(variable.name) ? (
					<a href="#" onClick={() => panelCollapseHelper.setPanelCollapsed(variable.name, false)}>
						More
					</a>
				) : (
					<a href="#" onClick={() => panelCollapseHelper.setPanelCollapsed(variable.name, true)}>
						Less
					</a>
				)}
			</td>
		</tr>
	)
})
