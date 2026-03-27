import React from 'react'
import { ContextHelpButton, type ContextHelpButtonProps } from '~/Layout/PanelIcons'

interface UserConfigHeadingRowProps {
	label: string
	helpMessage?: React.ReactNode
	helpAction?: ContextHelpButtonProps['action']
}

export function UserConfigHeadingRow({ label, helpMessage, helpAction }: UserConfigHeadingRowProps): React.JSX.Element {
	return (
		<>
			<tr className="settings-category-spacer"></tr>
			<tr className="settings-category-row">
				<th colSpan={3}>
					<span className="d-flex justify-content-start">
						{label}
						{(helpMessage || helpAction) && (
							<span className="ms-auto px-2">
								<ContextHelpButton action={helpAction}>{helpMessage}</ContextHelpButton>
							</span>
						)}
					</span>
				</th>
			</tr>
		</>
	)
}
