import React, { useCallback, useContext, useState, useMemo, useEffect, memo } from 'react'
import { CAlert, CButton, CInput, CInputGroup, CInputGroupAppend } from '@coreui/react'
import {
	SocketContext,
	socketEmitPromise,
	NotifierContext,
	PropertyDefinitionsContext,
	InstancesContext,
} from '../util'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faTimes } from '@fortawesome/free-solid-svg-icons'

export function VariablesTable({ label }) {
	const socket = useContext(SocketContext)
	const notifier = useContext(NotifierContext)
	const propertyDefinitionsContext = useContext(PropertyDefinitionsContext)
	const instancesContext = useContext(InstancesContext)

	const instanceId = Object.entries(instancesContext || {}).find((e) => e[1]?.label === label)?.[0]
	const propertyDefinitions = propertyDefinitionsContext[instanceId]

	const [variableValues, setVariableValues] = useState({})
	const [filter, setFilter] = useState('')

	const variableDefinitions = useMemo(() => {
		const defs = []
		for (const [propertyId, property] of Object.entries(propertyDefinitions || {})) {
			defs.push({
				// ...variable,
				label: property.name,
				name: propertyId,
			})
		}

		defs.sort((a, b) =>
			a.name.localeCompare(b.name, undefined, {
				numeric: true,
			})
		)

		return defs
	}, [propertyDefinitions])

	useEffect(() => {
		if (label) {
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
		}
	}, [socket, label])

	const onCopied = useCallback(() => {
		notifier.current.show(`Copied`, 'Copied to clipboard', 5000)
	}, [notifier])

	const [candidates, errorMsg] = useMemo(() => {
		let candidates = []
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
	const updateFilter = useCallback((e) => setFilter(e.currentTarget.value), [])

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
					{candidates &&
						candidates.map((variable) => (
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
}

const VariablesTableRow = memo(function VariablesTableRow({ variable, value, label, onCopied }) {
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
				$({label}:{variable.name})
			</td>
			<td>{variable.label}</td>
			<td>
				{elms === '' || elms === null || elms === undefined ? (
					'(empty)'
				) : (
					<code style={{ backgroundColor: 'rgba(255,0,0,0.1)', padding: '1px 4px' }}>{elms}</code>
				)}
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
