import React from 'react'
import { WIZARD_VERSION_3_0 } from './index.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

interface ApplyStepProps {
	oldConfig: UserConfigModel
	newConfig: UserConfigModel
}

export function ApplyStep({ oldConfig, newConfig }: ApplyStepProps) {
	let changes = []

	if (oldConfig.setup_wizard < WIZARD_VERSION_3_0 || oldConfig.usb_hotplug !== newConfig.usb_hotplug) {
		changes.push(
			newConfig.usb_hotplug ? (
				<li>Companion will watch for and use newly detected USB devices.</li>
			) : (
				<li>After attaching a new USB device, you must scan for it in the Surfaces tab.</li>
			)
		)
	}

	if (oldConfig.setup_wizard === 0 || oldConfig.elgato_plugin_enable !== newConfig.elgato_plugin_enable) {
		changes.push(
			newConfig.elgato_plugin_enable ? (
				<li>Stream Deck hardware will access Companion via the Stream Deck software and the Companion plugin.</li>
			) : (
				<li>
					Stream Deck hardware will be detected by Companion natively.
					<br />
					<span style={{ color: 'red' }}>The Stream Deck software must be closed for this to work.</span>
				</li>
			)
		)
	}

	if (oldConfig.setup_wizard === 0 || oldConfig.xkeys_enable !== newConfig.xkeys_enable) {
		changes.push(
			newConfig.xkeys_enable ? (
				<li>X-keys hardware will be detected by Companion.</li>
			) : (
				<li>X-keys hardware will {oldConfig.setup_wizard > 0 ? 'no longer' : 'not'} be detected by Companion.</li>
			)
		)
	}

	if (oldConfig.setup_wizard === 0 || oldConfig.loupedeck_enable !== newConfig.loupedeck_enable) {
		changes.push(
			newConfig.loupedeck_enable ? (
				<li>Loupedeck and Razer Stream Controller hardware will be detected by Companion.</li>
			) : (
				<li>
					Loupedeck and Razer Stream Controller hardware will {oldConfig.setup_wizard > 0 ? 'no longer' : 'not'} be
					detected by Companion.
				</li>
			)
		)
	}

	if (oldConfig.setup_wizard === 0 || oldConfig.mirabox_streamdock_enable !== newConfig.mirabox_streamdock_enable || typeof oldConfig.mirabox_streamdock_enable !== 'boolean') {
		changes.push(
			newConfig.mirabox_streamdock_enable ? (
				<li>Mirabox Stream Dock hardware will be detected by Companion.</li>
			) : (
				<li>
					Mirabox Stream Dock hardware will {oldConfig.setup_wizard > 0 ? 'no longer' : 'not'} be detected by Companion.
				</li>
			)
		)
	}

	if (oldConfig.setup_wizard === 0 || oldConfig.contour_shuttle_enable !== newConfig.contour_shuttle_enable) {
		changes.push(
			newConfig.contour_shuttle_enable ? (
				<li>Contour Shuttle hardware will be detected by Companion.</li>
			) : (
				<li>
					Contour Shuttle hardware will {oldConfig.setup_wizard > 0 ? 'no longer' : 'not'} be detected by Companion.
				</li>
			)
		)
	}

	if (oldConfig.setup_wizard === 0 || oldConfig.vec_footpedal_enable !== newConfig.vec_footpedal_enable) {
		changes.push(
			newConfig.vec_footpedal_enable ? (
				<li>VEC Footpedal hardware will be detected by Companion.</li>
			) : (
				<li>
					VEC Footpedal hardware will {oldConfig.setup_wizard > 0 ? 'no longer' : 'not'} be detected by Companion.
				</li>
			)
		)
	}

	if (oldConfig.setup_wizard === 0 || oldConfig.mystrix_enable !== newConfig.mystrix_enable) {
		changes.push(
			newConfig.mystrix_enable ? (
				<li>203 Systems Mystrix hardware will be detected by Companion.</li>
			) : (
				<li>
					203 Systems Mystrix hardware will {oldConfig.setup_wizard > 0 ? 'no longer' : 'not'} be detected by Companion.
				</li>
			)
		)
	}

	if (oldConfig.setup_wizard === 0 || oldConfig.videohub_panel_enabled !== newConfig.videohub_panel_enabled) {
		changes.push(
			newConfig.videohub_panel_enabled ? (
				<li>Companion will listen for Videohub Panels.</li>
			) : (
				<li>Companion will {oldConfig.setup_wizard > 0 ? 'no longer' : 'not'} listen for Videohub Panels.</li>
			)
		)
	}

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

		changes.push(
			<li>
				Button grid size will be {newGridSize?.maxRow - newGridSize?.minRow + 1} rows x{' '}
				{newGridSize?.maxColumn - newGridSize?.minColumn + 1} columns
				{oldConfig.setup_wizard !== 0 && isReducingSize && (
					<>
						<br />
						<span style={{ color: 'red' }}>
							By reducing the grid size, any buttons outside of the new boundaries will be deleted.
						</span>
					</>
				)}
			</li>
		)
	}

	if (
		oldConfig.setup_wizard === 0 &&
		!newConfig.tcp_enabled &&
		!newConfig.udp_enabled &&
		!newConfig.osc_enabled &&
		!newConfig.rosstalk_enabled &&
		!newConfig.emberplus_enabled &&
		!newConfig.artnet_enabled
	) {
		changes.push(<li>No remote control services will be enabled.</li>)
	} else {
		if (oldConfig.tcp_enabled !== newConfig.tcp_enabled) {
			changes.push(
				newConfig.tcp_enabled ? (
					<li style={{ color: 'green' }}>Enable TCP Listener</li>
				) : (
					<li style={{ color: 'red' }}>Disable TCP Listener</li>
				)
			)
		}
		if (
			(oldConfig.setup_wizard === 0 && newConfig.tcp_enabled && !oldConfig.tcp_enabled) ||
			(newConfig.tcp_enabled && oldConfig.tcp_listen_port !== newConfig.tcp_listen_port)
		) {
			changes.push(
				<li>
					{oldConfig.setup_wizard > 0 || oldConfig.tcp_enabled ? 'Change' : 'Set'} TCP listen port to{' '}
					{newConfig.tcp_listen_port}
				</li>
			)
		}

		if (oldConfig.udp_enabled !== newConfig.udp_enabled) {
			changes.push(
				newConfig.udp_enabled ? (
					<li style={{ color: 'green' }}>Enable TCP Listener</li>
				) : (
					<li style={{ color: 'red' }}>Disable TCP Listener</li>
				)
			)
		}
		if (
			(oldConfig.setup_wizard === 0 && newConfig.udp_enabled && !oldConfig.udp_enabled) ||
			(newConfig.udp_enabled && oldConfig.udp_listen_port !== newConfig.udp_listen_port)
		) {
			changes.push(
				<li>
					{oldConfig.setup_wizard > 0 || oldConfig.udp_enabled ? 'Change' : 'Set'} UDP listen port to{' '}
					{newConfig.udp_listen_port}
				</li>
			)
		}

		if (oldConfig.osc_enabled !== newConfig.osc_enabled) {
			changes.push(
				newConfig.osc_enabled ? (
					<li style={{ color: 'green' }}>Enable OSC Listener</li>
				) : (
					<li style={{ color: 'red' }}>Disable OSC Listener</li>
				)
			)
		}
		if (
			(oldConfig.setup_wizard === 0 && newConfig.osc_enabled && !oldConfig.osc_enabled) ||
			(newConfig.osc_enabled && oldConfig.osc_listen_port !== newConfig.osc_listen_port)
		) {
			changes.push(
				<li>
					{oldConfig.setup_wizard > 0 || oldConfig.osc_enabled ? 'Change' : 'Set'} OSC listen port to{' '}
					{newConfig.osc_listen_port}
				</li>
			)
		}

		if (oldConfig.rosstalk_enabled !== newConfig.rosstalk_enabled) {
			changes.push(
				newConfig.rosstalk_enabled ? (
					<li style={{ color: 'green' }}>Enable Rosstalk Listener</li>
				) : (
					<li style={{ color: 'red' }}>Disable Rosstalk Listener</li>
				)
			)
		}

		if (oldConfig.emberplus_enabled !== newConfig.emberplus_enabled) {
			changes.push(
				newConfig.emberplus_enabled ? (
					<li style={{ color: 'green' }}>Enable Ember+ Listener</li>
				) : (
					<li style={{ color: 'red' }}>Disable Ember+ Listener</li>
				)
			)
		}

		if (oldConfig.artnet_enabled !== newConfig.artnet_enabled) {
			changes.push(
				newConfig.artnet_enabled ? (
					<li style={{ color: 'green' }}>Enable Artnet Listener</li>
				) : (
					<li style={{ color: 'red' }}>Disable Artnet Listener</li>
				)
			)
		}
		if (
			(oldConfig.setup_wizard === 0 && newConfig.artnet_enabled && !oldConfig.artnet_enabled) ||
			(newConfig.artnet_enabled && oldConfig.artnet_universe !== newConfig.artnet_universe)
		) {
			changes.push(
				<li>
					{oldConfig.setup_wizard > 0 || oldConfig.artnet_enabled ? 'Change' : 'Set'} Artnet Universe to{' '}
					{newConfig.artnet_universe}
				</li>
			)
		}
		if (
			(oldConfig.setup_wizard === 0 && newConfig.artnet_enabled && !oldConfig.artnet_enabled) ||
			(newConfig.artnet_enabled && oldConfig.artnet_channel !== newConfig.artnet_channel)
		) {
			changes.push(
				<li>
					{oldConfig.setup_wizard > 0 || oldConfig.artnet_enabled ? 'Change' : 'Set'} Artnet Channel to{' '}
					{newConfig.artnet_channel}
				</li>
			)
		}
	}

	if (oldConfig.setup_wizard === 0 || oldConfig.admin_lockout !== newConfig.admin_lockout) {
		changes.push(
			newConfig.admin_lockout ? (
				<li>This admin interface will {oldConfig.setup_wizard > 0 ? 'now' : ''} be password protected.</li>
			) : (
				<li>This admin interface will not be password protected.</li>
			)
		)
	}
	if (
		(oldConfig.setup_wizard === 0 && newConfig.admin_lockout) ||
		(newConfig.admin_lockout && oldConfig.admin_password !== newConfig.admin_password)
	) {
		oldConfig.setup_wizard > 0
			? changes.push(
					<li>
						Change admin password from {oldConfig.admin_password === '' ? '(none)' : `'${oldConfig.admin_password}'`} to{' '}
						'{newConfig.admin_password}'.
					</li>
				)
			: changes.push(<li>Set admin password to '{newConfig.admin_password}'.</li>)
	}
	if (
		(oldConfig.setup_wizard === 0 && newConfig.admin_lockout) ||
		(newConfig.admin_lockout && oldConfig.admin_timeout !== newConfig.admin_timeout)
	) {
		const oldAdminTimeoutStr = oldConfig.admin_timeout + ''
		const newAdminTimeoutStr = newConfig.admin_timeout + ''
		oldConfig.setup_wizard > 0
			? changes.push(
					<li>
						Change admin GUI timeout from {oldAdminTimeoutStr === '0' ? 'none' : oldConfig.admin_timeout + ' minutes'}{' '}
						to {newAdminTimeoutStr ? 'none' : newConfig.admin_timeout + ' minutes'}.
					</li>
				)
			: changes.push(
					<li>Set admin GUI timeout to {newAdminTimeoutStr ? 'none' : newConfig.admin_timeout + ' minutes'}.</li>
				)
	}

	if (changes.length === 0) {
		changes.push(<li>No changes to the configuration will be made.</li>)
	}

	return (
		<div>
			<h5>Review Settings</h5>
			<p>The following configuration {oldConfig.setup_wizard > 0 ? 'settings' : 'changes'} will be applied:</p>
			<ul>{changes}</ul>
		</div>
	)
}
