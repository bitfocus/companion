import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { InlineHelp } from '~/Components/InlineHelp'

interface UserConfigHeadingRowProps {
	label: string
	tooltip?: string
}
export function UserConfigHeadingRow({ label, tooltip }: UserConfigHeadingRowProps): React.JSX.Element {
	return (
		<>
			<tr className="settings-category-spacer"></tr>
			<tr className="settings-category-row">
				<th colSpan={3}>
					<span className="d-flex justify-content-start">
						{label}
						{tooltip && (
							<span className="ms-auto px-2">
								<InlineHelp help={tooltip}>
									<FontAwesomeIcon icon={faQuestionCircle} />
								</InlineHelp>
							</span>
						)}
					</span>
				</th>
			</tr>
		</>
	)
}
