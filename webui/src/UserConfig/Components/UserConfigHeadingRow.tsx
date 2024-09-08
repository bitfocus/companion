import React from 'react'

interface UserConfigHeadingRowProps {
	label: string
}
export function UserConfigHeadingRow({ label }: UserConfigHeadingRowProps) {
	return (
		<tr>
			<th colSpan={3} className="settings-category">
				{label}
			</th>
		</tr>
	)
}
