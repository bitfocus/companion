import { faCog } from '@fortawesome/free-solid-svg-icons'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { StatusBadge } from '~/Components/StatusBadge.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import type { UserConfigProps } from './Components/Common.js'
import { useUserConfigProps } from './Context.js'
import { PROTOCOLS, type ProtocolDefinition } from './ProtocolDefinitions.js'
import { SettingsNav } from './SettingsNav.js'

export const SettingsProtocolsPage = observer(function UserConfig() {
	const navigate = useNavigate({ from: '/settings/protocols' })

	const doEditProtocol = useCallback(
		(protocolId: string) => {
			void navigate({ to: `/settings/protocols/${protocolId}` })
		},
		[navigate]
	)

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/settings/protocols/$protocolId' })
	const selectedProtocolId = routeMatch ? routeMatch.protocolId : null

	const userConfigProps = useUserConfigProps()

	return (
		<div className="page-shell">
			<PageHeader icon={faCog} title="Settings" helpAction="/user-guide/config/settings#protocols" />

			<SettingsNav activeTab="protocols" />

			<SplitPanels.Root showing={selectedProtocolId ? 'secondary' : 'primary'} resize={{ storageKey: 'protocols' }}>
				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2">
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg shrink-0">
							<p className="text-xs text-muted mb-0">
								Network endpoints for controlling Companion remotely. Select one to change its settings or find its API
								reference.
							</p>
						</div>

						<div className="flex-1 min-h-0 scrollable-content list-card p-2">
							{userConfigProps && (
								<div className="space-y-1">
									{PROTOCOLS.map((protocol) => (
										<ProtocolsListRow
											key={protocol.id}
											protocol={protocol}
											userConfig={userConfigProps}
											isSelected={protocol.id === selectedProtocolId}
											editProtocol={doEditProtocol}
										/>
									))}
								</div>
							)}
						</div>
					</div>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						<Outlet />
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</div>
	)
})

interface ProtocolsListRowProps {
	protocol: ProtocolDefinition
	userConfig: UserConfigProps
	isSelected: boolean
	editProtocol: (protocolId: string) => void
}

const ProtocolsListRow = observer(function ProtocolsListRow({
	protocol,
	userConfig,
	isSelected,
	editProtocol,
}: ProtocolsListRowProps) {
	const { enabledField } = protocol
	const isEnabled = enabledField === null || !!userConfig.config[enabledField]

	const doEdit = useCallback(() => editProtocol(protocol.id), [editProtocol, protocol.id])

	return (
		<div
			className={classNames(
				'list-row flex items-center gap-3 py-2.5 pe-2.5',
				isSelected ? 'list-row-selected' : 'hover:bg-surface-muted/50'
			)}
		>
			<div className={classNames('grow min-w-0', { 'opacity-60': !isEnabled })} onClick={doEdit}>
				<b className="text-sm font-semibold text-body-strong truncate block">{protocol.name}</b>
				<span className="text-xs text-muted/80 font-normal">{protocol.summary(userConfig.config)}</span>
			</div>
			<div onClick={doEdit} className="shrink-0 flex items-center justify-center">
				{enabledField === null ? (
					<StatusBadge tone="good" title="This protocol can't be disabled">
						Always on
					</StatusBadge>
				) : isEnabled ? (
					<StatusBadge tone="good">Enabled</StatusBadge>
				) : (
					<StatusBadge tone="disabled">Disabled</StatusBadge>
				)}
			</div>
			{enabledField !== null && (
				<div className="shrink-0 flex items-center gap-2">
					<SwitchInputField
						id={undefined}
						value={isEnabled}
						setValue={(value) => userConfig.setValue(enabledField, value)}
						disabled={userConfig.readonlyKeys.has(enabledField)}
						tooltip={isEnabled ? `Disable ${protocol.name}` : `Enable ${protocol.name}`}
					/>
				</div>
			)}
		</div>
	)
})
