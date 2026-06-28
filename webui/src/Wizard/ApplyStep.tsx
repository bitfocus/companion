/* eslint-disable react-refresh/only-export-components */
import { faCheck, faCircleInfo, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { TIMEZONE_CHOICES } from '~/Resources/timezones.js'
import { WIZARD_VERSION_3_0, WIZARD_VERSION_4_2, WIZARD_VERSION_5_0 } from './Constants.js'

interface ApplyStepProps {
	oldConfig: UserConfigModel
	newConfig: UserConfigModel
}

type ChangeTone = 'add' | 'remove' | 'info'

export interface WizardChange {
	category: string
	tone: ChangeTone
	content: React.ReactNode
}

const TONE_ICON = { add: faCheck, remove: faXmark, info: faCircleInfo } as const

/** Compute the list of changes the wizard will apply, comparing the original config to the edited one. */
export function getWizardChanges(oldConfig: UserConfigModel, newConfig: UserConfigModel): WizardChange[] {
	const changes: WizardChange[] = []
	let category = ''
	const add = (tone: ChangeTone, content: React.ReactNode) => changes.push({ category, tone, content })

	category = 'Surfaces'
	if (oldConfig.setup_wizard < WIZARD_VERSION_3_0 || oldConfig.usb_hotplug !== newConfig.usb_hotplug) {
		add(
			'info',
			newConfig.usb_hotplug
				? 'Companion will watch for and use newly detected USB devices.'
				: 'After attaching a new USB device, you must scan for it in the Surfaces tab.'
		)
	}

	if (
		oldConfig.setup_wizard < WIZARD_VERSION_3_0 ||
		oldConfig.auto_enable_discovered_surfaces !== newConfig.auto_enable_discovered_surfaces
	) {
		add(
			'info',
			newConfig.auto_enable_discovered_surfaces
				? 'Newly discovered surfaces will be automatically enabled.'
				: 'Newly discovered surfaces will need to be manually enabled in the Surfaces tab.'
		)
	}

	category = 'Button Grid'
	if (
		oldConfig.setup_wizard === 0 ||
		newConfig?.gridSize.minColumn !== oldConfig.gridSize.minColumn ||
		newConfig?.gridSize.maxColumn !== oldConfig.gridSize.maxColumn ||
		newConfig?.gridSize.minRow !== oldConfig.gridSize.minRow ||
		newConfig?.gridSize.maxRow !== oldConfig.gridSize.maxRow
	) {
		const isReducingSize =
			newConfig?.gridSize &&
			oldConfig?.gridSize &&
			(newConfig?.gridSize.minColumn > oldConfig.gridSize.minColumn ||
				newConfig?.gridSize.maxColumn < oldConfig.gridSize.maxColumn ||
				newConfig?.gridSize.minRow > oldConfig.gridSize.minRow ||
				newConfig?.gridSize.maxRow < oldConfig.gridSize.maxRow)

		const newGridSize = newConfig?.gridSize

		add(
			'info',
			<>
				Button grid size will be {newGridSize?.maxRow - newGridSize?.minRow + 1} rows x{' '}
				{newGridSize?.maxColumn - newGridSize?.minColumn + 1} columns
				{oldConfig.setup_wizard !== 0 && isReducingSize && (
					<>
						<br />
						<span className="text-danger">
							By reducing the grid size, any buttons outside of the new boundaries will be deleted.
						</span>
					</>
				)}
			</>
		)
	}

	category = 'Remote Control Services'
	if (
		oldConfig.setup_wizard === 0 &&
		!newConfig.tcp_enabled &&
		!newConfig.udp_enabled &&
		!newConfig.osc_enabled &&
		!newConfig.rosstalk_enabled &&
		!newConfig.emberplus_enabled &&
		!newConfig.artnet_enabled
	) {
		add('info', 'No remote control services will be enabled.')
	} else {
		if (oldConfig.tcp_enabled !== newConfig.tcp_enabled) {
			add(newConfig.tcp_enabled ? 'add' : 'remove', `${newConfig.tcp_enabled ? 'Enable' : 'Disable'} TCP Listener`)
		}
		if (
			(oldConfig.setup_wizard === 0 && newConfig.tcp_enabled && !oldConfig.tcp_enabled) ||
			(newConfig.tcp_enabled && oldConfig.tcp_listen_port !== newConfig.tcp_listen_port)
		) {
			add(
				'info',
				`${oldConfig.setup_wizard > 0 || oldConfig.tcp_enabled ? 'Change' : 'Set'} TCP listen port to ${newConfig.tcp_listen_port}`
			)
		}

		if (oldConfig.udp_enabled !== newConfig.udp_enabled) {
			add(newConfig.udp_enabled ? 'add' : 'remove', `${newConfig.udp_enabled ? 'Enable' : 'Disable'} UDP Listener`)
		}
		if (
			(oldConfig.setup_wizard === 0 && newConfig.udp_enabled && !oldConfig.udp_enabled) ||
			(newConfig.udp_enabled && oldConfig.udp_listen_port !== newConfig.udp_listen_port)
		) {
			add(
				'info',
				`${oldConfig.setup_wizard > 0 || oldConfig.udp_enabled ? 'Change' : 'Set'} UDP listen port to ${newConfig.udp_listen_port}`
			)
		}

		if (oldConfig.osc_enabled !== newConfig.osc_enabled) {
			add(newConfig.osc_enabled ? 'add' : 'remove', `${newConfig.osc_enabled ? 'Enable' : 'Disable'} OSC Listener`)
		}
		if (
			(oldConfig.setup_wizard === 0 && newConfig.osc_enabled && !oldConfig.osc_enabled) ||
			(newConfig.osc_enabled && oldConfig.osc_listen_port !== newConfig.osc_listen_port)
		) {
			add(
				'info',
				`${oldConfig.setup_wizard > 0 || oldConfig.osc_enabled ? 'Change' : 'Set'} OSC listen port to ${newConfig.osc_listen_port}`
			)
		}

		if (oldConfig.rosstalk_enabled !== newConfig.rosstalk_enabled) {
			add(
				newConfig.rosstalk_enabled ? 'add' : 'remove',
				`${newConfig.rosstalk_enabled ? 'Enable' : 'Disable'} Rosstalk Listener`
			)
		}

		if (oldConfig.emberplus_enabled !== newConfig.emberplus_enabled) {
			add(
				newConfig.emberplus_enabled ? 'add' : 'remove',
				`${newConfig.emberplus_enabled ? 'Enable' : 'Disable'} Ember+ Listener`
			)
		}

		if (oldConfig.artnet_enabled !== newConfig.artnet_enabled) {
			add(
				newConfig.artnet_enabled ? 'add' : 'remove',
				`${newConfig.artnet_enabled ? 'Enable' : 'Disable'} Artnet Listener`
			)
		}
		if (
			(oldConfig.setup_wizard === 0 && newConfig.artnet_enabled && !oldConfig.artnet_enabled) ||
			(newConfig.artnet_enabled && oldConfig.artnet_universe !== newConfig.artnet_universe)
		) {
			add(
				'info',
				`${oldConfig.setup_wizard > 0 || oldConfig.artnet_enabled ? 'Change' : 'Set'} Artnet Universe to ${newConfig.artnet_universe}`
			)
		}
		if (
			(oldConfig.setup_wizard === 0 && newConfig.artnet_enabled && !oldConfig.artnet_enabled) ||
			(newConfig.artnet_enabled && oldConfig.artnet_channel !== newConfig.artnet_channel)
		) {
			add(
				'info',
				`${oldConfig.setup_wizard > 0 || oldConfig.artnet_enabled ? 'Change' : 'Set'} Artnet Channel to ${newConfig.artnet_channel}`
			)
		}
	}

	category = 'Usage Statistics'
	if (
		oldConfig.setup_wizard < WIZARD_VERSION_4_2 ||
		oldConfig.detailed_data_collection !== newConfig.detailed_data_collection
	) {
		add(
			newConfig.detailed_data_collection ? 'add' : 'remove',
			newConfig.detailed_data_collection
				? 'Send anonymous usage statistics.'
				: 'Anonymous usage statistics will not be sent.'
		)
	}

	category = 'Security'
	if (oldConfig.setup_wizard === 0 || oldConfig.admin_lockout !== newConfig.admin_lockout) {
		add(
			'info',
			newConfig.admin_lockout
				? `This admin interface will ${oldConfig.setup_wizard > 0 ? 'now ' : ''}be password protected.`
				: 'This admin interface will not be password protected.'
		)
	}
	if (
		(oldConfig.setup_wizard === 0 && newConfig.admin_lockout) ||
		(newConfig.admin_lockout && oldConfig.admin_password !== newConfig.admin_password)
	) {
		add(
			'info',
			oldConfig.setup_wizard > 0 ? (
				<>
					Change admin password from {oldConfig.admin_password === '' ? '(none)' : `'${oldConfig.admin_password}'`} to '
					{newConfig.admin_password}'.
				</>
			) : (
				<>Set admin password to '{newConfig.admin_password}'.</>
			)
		)
	}
	if (
		(oldConfig.setup_wizard === 0 && newConfig.admin_lockout) ||
		(newConfig.admin_lockout && oldConfig.admin_timeout !== newConfig.admin_timeout)
	) {
		const oldAdminTimeoutStr = oldConfig.admin_timeout + ''
		const newAdminTimeoutStr = newConfig.admin_timeout + ''
		add(
			'info',
			oldConfig.setup_wizard > 0
				? `Change admin GUI timeout from ${oldAdminTimeoutStr === '0' ? 'none' : oldConfig.admin_timeout + ' minutes'} to ${newAdminTimeoutStr ? 'none' : newConfig.admin_timeout + ' minutes'}.`
				: `Set admin GUI timeout to ${newAdminTimeoutStr ? 'none' : newConfig.admin_timeout + ' minutes'}.`
		)
	}

	category = 'Timezone'
	if (oldConfig.setup_wizard < WIZARD_VERSION_5_0 || oldConfig.timezone !== newConfig.timezone) {
		const tzLabel = TIMEZONE_CHOICES.find((c) => c.id === (newConfig.timezone ?? ''))?.label ?? newConfig.timezone
		add('info', `${oldConfig.setup_wizard > 0 ? 'Change' : 'Set'} timezone to ${tzLabel}.`)
	}

	return changes
}

export function ApplyStep({ oldConfig, newConfig }: ApplyStepProps): React.JSX.Element {
	const changes = getWizardChanges(oldConfig, newConfig)

	// Group consecutive changes by category, preserving order
	const groups: { category: string; items: WizardChange[] }[] = []
	for (const change of changes) {
		const last = groups[groups.length - 1]
		if (last && last.category === change.category) {
			last.items.push(change)
		} else {
			groups.push({ category: change.category, items: [change] })
		}
	}

	return (
		<div>
			<h5>Review Settings</h5>
			<p>The following {oldConfig.setup_wizard > 0 ? 'settings' : 'changes'} will be applied:</p>
			<div className="wizard-review">
				{groups.map((group) => (
					<div key={group.category} className="wizard-review-group">
						<div className="wizard-review-group-title">{group.category}</div>
						<ul className="wizard-review-list">
							{group.items.map((change, i) => (
								<li key={i} className="wizard-review-item">
									<span className={`wizard-review-badge wizard-review-badge-${change.tone}`}>
										<FontAwesomeIcon icon={TONE_ICON[change.tone]} />
									</span>
									<span>{change.content}</span>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</div>
	)
}
