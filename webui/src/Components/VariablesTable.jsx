import React, { useCallback, useContext, useState, useMemo, memo } from 'react'
import { CAlert, CButton, CInput, CInputGroup, CInputGroupAppend } from '@coreui/react'
import { socketEmit, StaticContext, VariableDefinitionsContext } from '../util'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faTimes } from '@fortawesome/free-solid-svg-icons'
import { useEffect } from 'react'

export function VariablesTable({ label }) {
	const context = useContext(StaticContext)
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)

	const variableDefinitions = variableDefinitionsContext[label]
	const [variableValues, setVariableValues] = useState({})
	const [filter, setFilter] = useState('')

	useEffect(() => {
		if (label) {
			const doPoll = () => {
				socketEmit(context.socket, 'variable_values_for_instance', [label])
					.then(([values]) => {
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
		}
	}, [context.socket, label])

	const onCopied = useCallback(() => {
		context.notifier.current.show(`Copied`, 'Copied to clipboard', 5000)
	}, [context.notifier])

	const [candidates, errorMsg] = useMemo(() => {
		let candidates = []
		if (variableDefinitions) {
			try {
				if (!filter) {
					candidates = Object.entries(variableDefinitions)
				} else {
					const regexp = new RegExp(filter, 'i')

					candidates = Object.entries(variableDefinitions).filter(
						([name, variable]) => name.match(regexp) || variable.label.match(regexp)
					)
				}
				return [candidates, null]
			} catch (e) {
				console.error('Failed to compile candidates list:', e)

				return [null, e?.toString() || 'Unknown error']
			}
		} else {
			return [null, null]
		}
	}, [variableDefinitions, filter])

	const clearFilter = useCallback(() => setFilter(''), [])
	const updateFilter = useCallback((e) => setFilter(e.currentTarget.value), [])

	if (!variableDefinitions || Object.keys(variableDefinitions).length === 0) {
		return (
			<CAlert color="warning" role="alert">
				Connection has no variables
			</CAlert>
		)
	}

	return (
		<>
			<CInputGroup className="variables-table-filter">
				<CInput
					type="text"
					placeholder="Filter ..."
					onChange={updateFilter}
					value={filter}
					style={{ fontSize: '1.2em' }}
				/>
				<CInputGroupAppend>
					<CButton color="danger" onClick={clearFilter}>
						<FontAwesomeIcon icon={faTimes} />
					</CButton>
				</CInputGroupAppend>
			</CInputGroup>
			<table className="table table-responsive-sm variables-table">
				<thead>
					<tr>
						<th>Variable</th>
						<th>Description</th>
						<th>Current value</th>
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
					{candidates &&
						candidates.map(([name, variable]) => (
							<VariablesTableRow
								key={variable.name}
								variable={variable}
								name={name}
								value={variableValues[name]}
								label={label}
								onCopied={onCopied}
							/>
						))}
				</tbody>
			</table>
		</>
	)
}

const VariablesTableRow = memo(function VariablesTableRow({ variable, value, name, label, onCopied }) {
	if (typeof value !== 'string') {
		value += ''
	}

	// Split into the lines
	const elms = []
	const lines = value.split('\\n')
	for (const i in lines) {
		const l = lines[i]
		elms.push(l)
		if (i <= lines.length - 1) {
			elms.push(<br key={i} />)
		}
	}

	return (
		<tr>
			<td>
				$({label}:{name})
			</td>
			<td>{variable.label}</td>
			<td>{elms}</td>
			<td>
				<CopyToClipboard text={`$(${label}:${name})`} onCopy={onCopied}>
					<CButton size="sm">
						<FontAwesomeIcon icon={faCopy} />
					</CButton>
				</CopyToClipboard>
			</td>
		</tr>
	)
})
