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

interface VariablesTableProps {
	label: string
}

export const VariablesTable = observer(function VariablesTable({ label }: VariablesTableProps) {
	const { socket, notifier, variablesStore } = useContext(RootAppStoreContext)

	const [variableValues, setVariableValues] = useState<CompanionVariableValues>({})
	const [filter, setFilter] = useState('')

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
}

const VariablesTableRow = memo(function VariablesTableRow({
	variable,
	value: valueRaw,
	label,
	onCopied,
}: VariablesTableRowProps) {
	const value = typeof valueRaw !== 'string' ? valueRaw + '' : valueRaw

	// Split into the lines
	const elms: Array<string | JSX.Element> = []
	const lines = value.split('\\n')
	lines.forEach((l, i) => {
		elms.push(l)
		if (i <= lines.length - 1) {
			elms.push(<br key={i} />)
		}
	})

	return (
		<tr>
			<td>
				$({label}:{variable.name})
			</td>
			<td>{variable.label}</td>
			<td>
				{
					/*elms === '' || elms === null || elms === undefined */ lines.length === 0 ||
					valueRaw === undefined ||
					valueRaw === null ? (
						'(empty)'
					) : (
						<code style={{ backgroundColor: 'rgba(255,0,0,0.1)', padding: '1px 4px' }}>{elms}</code>
					)
				}
			</td>
			<td>
				<CopyToClipboard text={`$(${label}:${variable.name})`} onCopy={onCopied}>
					<CButton size="sm">
						<FontAwesomeIcon icon={faCopy} />
					</CButton>
				</CopyToClipboard>
			</td>
		</tr>
	)
})
