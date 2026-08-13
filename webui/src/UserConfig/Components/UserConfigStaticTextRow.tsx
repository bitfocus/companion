import { observer } from 'mobx-react-lite'
import { InlineHelpIcon } from '~/Components/InlineHelp'

interface UserConfigStaticTextRowProps {
	label: string | React.ReactNode
	text: string | React.ReactNode
	textHelp?: string
}
export const UserConfigStaticTextRow = observer(function UserConfigStaticTextRow({
	label,
	text,
	textHelp,
}: UserConfigStaticTextRowProps) {
	return (
		<tr>
			<td>{label}</td>
			<td colSpan={2} style={{ textAlign: 'center' }}>
				{text}
				{textHelp && <InlineHelpIcon className="ms-1">{textHelp}</InlineHelpIcon>}
			</td>
		</tr>
	)
})
