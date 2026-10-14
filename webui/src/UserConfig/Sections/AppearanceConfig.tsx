import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { Button, ButtonGroup } from '~/Components/Button.js'
import { THEME_CHOICES } from '~/Theme/themeChoices.js'
import { themeStore } from '~/Theme/ThemeState.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'

/** The light/dark theme. Kept in this browser rather than the user config, so each station can differ */
export const AppearanceConfig = observer(function AppearanceConfig() {
	return (
		<>
			<UserConfigHeadingRow label="Appearance" />
			<tr>
				<td>
					Theme
					<div className="text-xs text-muted">Saved in this browser only.</div>
				</td>
				<td className="settings-value-end">
					<ButtonGroup>
						{THEME_CHOICES.map((choice) => (
							<Button
								key={choice.id}
								color="secondary"
								size="sm"
								active={themeStore.preference === choice.id}
								onClick={() => themeStore.setPreference(choice.id)}
								title={choice.description}
							>
								<FontAwesomeIcon icon={choice.icon} className="me-1.5" />
								{choice.label}
							</Button>
						))}
					</ButtonGroup>
				</td>
				<td />
			</tr>
		</>
	)
})
