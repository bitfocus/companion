import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { InlineHelp } from '~/Components/InlineHelp'

interface UserConfigHeadingRowProps {
	label: string
	tooltip?: string | React.ReactNode
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
									{/* button is just to enable focus for keyboard navigation */}
									<button className="subhead-help-button" type="button" aria-label="context help">
										<FontAwesomeIcon icon={faQuestionCircle} size="lg" />
									</button>
								</InlineHelp>
							</span>
						)}
					</span>
				</th>
			</tr>
		</>
	)
}
