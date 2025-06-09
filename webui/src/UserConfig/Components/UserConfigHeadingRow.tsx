import React from 'react'

interface UserConfigHeadingRowProps {
	label: string
}
export function UserConfigHeadingRow({ label }: UserConfigHeadingRowProps): React.JSX.Element {
	return (
		<>
			<tr className="settings-category-spacer"></tr>
			<tr className="settings-category-row">
				<th colSpan={3}>{label}</th>
			</tr>
		</>
	)
}
