import React, { useCallback, useContext, useState } from 'react'
import { CButton } from '@coreui/react'
import { socketEmit, StaticContext, VariableDefinitionsContext } from '../util'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy } from '@fortawesome/free-solid-svg-icons'
import { useEffect } from 'react'

export function VariablesTable({ label }) {
	const context = useContext(StaticContext)
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)

	const variableDefinitions = variableDefinitionsContext[label] || {}
	const [variableValues, setVariableValues] = useState({})

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

	if (Object.keys(variableDefinitions).length > 0) {
		return (
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
					{Object.entries(variableDefinitions).map(([name, variable]) => {
						let value = variableValues[name]
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
							<tr key={name}>
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
					})}
				</tbody>
			</table>
		)
	} else {
		return <p>Connection has no variables</p>
	}
}
