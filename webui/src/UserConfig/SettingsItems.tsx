import { faFileLines, type IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { Button, LinkButtonExternal } from '~/Components/Button.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { StatusBadge } from '~/Components/StatusBadge.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { CloseButton, ContextHelpButton, type ContextHelpButtonProps } from '~/Layout/PanelIcons.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { makeAbsolutePath, useComputed } from '~/Resources/util.js'
import type { UserConfigProps } from './Components/Common.js'
import { ConfigStaticField, ConfigSwitchField } from './Components/ConfigFieldRows.js'
import { useUserConfigProps } from './Context.js'

/** A settings page made of items that are each listed with their on/off switch, and opened to edit the rest */
export interface SettingsItemDefinition {
	id: string
	name: string
	/**
	 * The user config key that switches it on and off; `'always-on'` for one that is always running and can't be
	 * switched off; or `null` for one that isn't something to switch on or off at all
	 */
	enabledField: keyof UserConfigModel | 'always-on' | null
	/** What it is for, as the summary at the top of its panel */
	description: string
	/** A one-line summary of how it is set up, for the list row */
	summary: (config: UserConfigModel) => string
	/** Where its documentation lives */
	docs: NonNullable<ContextHelpButtonProps['action']>
	/** The label of the button that opens `docs`, short enough to sit beside the description */
	docsLabel: string
	/** Its settings, as rows of the panel's settings section, or `null` when it has none */
	Settings: React.ComponentType<UserConfigProps> | null
	/** Anything more it needs that doesn't fit a settings row, as sections below them, or `null` */
	Section: React.ComponentType | null
}

/** The pages built from settings items, which open an item at `<basePath>/<item id>` */
export type SettingsItemsBasePath = '/settings/protocols' | '/settings/advanced'

function isItemEnabled(item: SettingsItemDefinition, config: UserConfigModel): boolean | null {
	if (item.enabledField === null) return null
	if (item.enabledField === 'always-on') return true
	return !!config[item.enabledField]
}

interface SettingsItemsListProps {
	items: readonly SettingsItemDefinition[]
	selectedId: string | null
	basePath: SettingsItemsBasePath
}

/** The items of a settings page, each with its status and switch; selecting one opens it in the secondary panel */
export const SettingsItemsList = observer(function SettingsItemsList({
	items,
	selectedId,
	basePath,
}: SettingsItemsListProps) {
	const navigate = useNavigate()
	const userConfigProps = useUserConfigProps()

	const editItem = useCallback(
		(itemId: string) => {
			void navigate({ to: `${basePath}/${itemId}` })
		},
		[navigate, basePath]
	)

	if (!userConfigProps) return null

	return (
		<div className="space-y-1">
			{items.map((item) => (
				<SettingsItemsListRow
					key={item.id}
					item={item}
					userConfig={userConfigProps}
					isSelected={item.id === selectedId}
					editItem={editItem}
				/>
			))}
		</div>
	)
})

interface SettingsItemsListRowProps {
	item: SettingsItemDefinition
	userConfig: UserConfigProps
	isSelected: boolean
	editItem: (itemId: string) => void
}

const SettingsItemsListRow = observer(function SettingsItemsListRow({
	item,
	userConfig,
	isSelected,
	editItem,
}: SettingsItemsListRowProps) {
	const { enabledField } = item
	const isEnabled = isItemEnabled(item, userConfig.config)

	const doEdit = useCallback(() => editItem(item.id), [editItem, item.id])

	return (
		<div
			className={classNames(
				'list-row flex items-center gap-3 py-2.5 pe-2.5',
				isSelected ? 'list-row-selected' : 'hover:bg-surface-muted/50'
			)}
		>
			<div className={classNames('grow min-w-0', { 'opacity-60': isEnabled === false })} onClick={doEdit}>
				<b className="text-sm font-semibold text-body-strong truncate block">{item.name}</b>
				<span className="text-xs text-muted/80 font-normal">{item.summary(userConfig.config)}</span>
			</div>
			{isEnabled !== null && (
				<div onClick={doEdit} className="shrink-0 flex items-center justify-center">
					{enabledField === 'always-on' ? (
						<StatusBadge tone="good" title="This can't be switched off">
							Always on
						</StatusBadge>
					) : isEnabled ? (
						<StatusBadge tone="good">Enabled</StatusBadge>
					) : (
						<StatusBadge tone="disabled">Disabled</StatusBadge>
					)}
				</div>
			)}
			{enabledField !== null && enabledField !== 'always-on' && (
				<div className="shrink-0 flex items-center gap-2">
					<SwitchInputField
						id={undefined}
						value={!!isEnabled}
						setValue={(value) => userConfig.setValue(enabledField, value)}
						disabled={userConfig.readonlyKeys.has(enabledField)}
						tooltip={isEnabled ? `Disable ${item.name}` : `Enable ${item.name}`}
					/>
				</div>
			)}
		</div>
	)
})

interface SettingsItemPanelProps {
	items: readonly SettingsItemDefinition[]
	itemId: string
	basePath: SettingsItemsBasePath
	icon: IconDefinition
	/** The hover text of the header's help button, which opens the item's docs */
	helpLabel: string
}

/** One settings item opened in the secondary panel, in the standard edit panel layout */
export const SettingsItemPanel = observer(function SettingsItemPanel({
	items,
	itemId,
	basePath,
	icon,
	helpLabel,
}: SettingsItemPanelProps) {
	const navigate = useNavigate()
	const userConfigProps = useUserConfigProps()

	const item = items.find((i) => i.id === itemId)

	useComputed(() => {
		if (!item) {
			void navigate({ to: basePath })
		}
	}, [navigate, item, basePath])

	const doClose = useCallback(() => {
		void navigate({ to: basePath })
	}, [navigate, basePath])

	if (!item) return null

	return (
		<>
			<PanelHeader icon={icon} title={item.name}>
				<ContextHelpButton action={item.docs}>{helpLabel}</ContextHelpButton>
				<CloseButton closeFn={doClose} />
			</PanelHeader>

			<div className="secondary-panel-simple-body">
				<MyErrorBoundary>
					{userConfigProps && (
						<div className="edit-panel">
							<EditSectionCard title="Settings">
								<div className="flex items-start justify-between gap-3">
									<p className="text-xs text-muted mb-0">{item.description}</p>
									<SettingsItemDocsButton item={item} />
								</div>

								<SettingsItemEnabledField item={item} userConfig={userConfigProps} />
								{item.Settings && <item.Settings {...userConfigProps} />}
							</EditSectionCard>

							{item.Section && <item.Section />}
						</div>
					)}
				</MyErrorBoundary>
			</div>
		</>
	)
})

function SettingsItemEnabledField({
	item,
	userConfig,
}: {
	item: SettingsItemDefinition
	userConfig: UserConfigProps
}): React.JSX.Element | null {
	if (item.enabledField === null) return null

	if (item.enabledField === 'always-on') {
		return <ConfigStaticField label="Enabled" value="Always on" help={`${item.name} can't be disabled.`} />
	}

	return <ConfigSwitchField userConfig={userConfig} label="Enabled" field={item.enabledField} help={null} />
}

function SettingsItemDocsButton({ item }: { item: SettingsItemDefinition }): React.JSX.Element {
	const { docs, docsLabel } = item

	const content = (
		<>
			<FontAwesomeIcon icon={faFileLines} className="me-1.5" />
			{docsLabel}
		</>
	)

	if (typeof docs === 'string') {
		return (
			<LinkButtonExternal color="secondary" size="sm" className="shrink-0" href={makeAbsolutePath(docs)}>
				{content}
			</LinkButtonExternal>
		)
	}

	return (
		<Button color="secondary" size="sm" className="shrink-0" onClick={docs}>
			{content}
		</Button>
	)
}
