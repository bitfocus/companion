import React from 'react'
import { observer } from 'mobx-react-lite'

interface UserConfigStaticTextRowProps {
	label: string | React.ReactNode
	text: string | React.ReactNode
}
export const UserConfigStaticTextRow = observer(function UserConfigStaticTextRow({
	label,
	text,
}: UserConfigStaticTextRowProps) {
	return (
		<tr>
			<td>{label}</td>
			<td colSpan={2} style={{ textAlign: 'center' }}>
				{text}
			</td>
		</tr>
	)
})
