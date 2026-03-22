import React from 'react'
import { ContextHelpButton, type ContextHelpButtonProps } from '~/Layout/PanelIcons'

interface UserConfigHeadingRowProps extends Partial<ContextHelpButtonProps> {
	label: string
}

export function UserConfigHeadingRow({
	label,
	tooltip,
	action,
	size = 'xl',
}: UserConfigHeadingRowProps): React.JSX.Element {
	return (
		<>
			<tr className="settings-category-spacer"></tr>
			<tr className="settings-category-row">
				<th colSpan={3}>
					<span className="d-flex justify-content-start">
						{label}
						{tooltip && (
							<span className="ms-auto px-2">
								<ContextHelpButton tooltip={tooltip} action={action} size={size} />
							</span>
						)}
					</span>
				</th>
			</tr>
		</>
	)
}
