import React, { useCallback, useContext } from 'react'
import { CButton } from '@coreui/react'
import { CompanionContext } from '../util'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy } from '@fortawesome/free-solid-svg-icons'

export function VariablesTable({ label }) {
	const context = useContext(CompanionContext)
	const variableDefinitions = context.variableDefinitions[label] || []
	const variableValues = context.variableValues || {}

	const onCopied = useCallback(() => {
		context.notifier.current.show(`Copied`, 'Copied to clipboard', 5000)

	}, [context.notifier])

	if (variableDefinitions.length > 0) {
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
					{
						variableDefinitions.map((variable) => <tr key={variable.name}>
							<td>$({label}:{variable.name})</td>
							<td>{variable.label}</td>
							<td>{variableValues[label + ':' + variable.name]}</td>
							<td>
								<CopyToClipboard text={`$(${label}:${variable.name})`} onCopy={onCopied}>
									<CButton>
										<FontAwesomeIcon icon={faCopy} />
									</CButton>
								</CopyToClipboard>
							</td>
						</tr>)
					}
				</tbody>
			</table>
		)
	} else {
		return <p>Instance has no variables</p>
	}
}