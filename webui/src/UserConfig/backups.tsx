import { useDragDropMonitor } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { faAdd, faCog, faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import dayjs from 'dayjs'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import type { BackupRulesConfig } from '@companion-app/shared/Model/UserConfigModel.js'
import { Button } from '~/Components/Button'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { NonIdealState } from '../Components/NonIdealState.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { backupTypes } from './BackupConstants.js'
import { SettingsNav } from './SettingsNav.js'

export const SettingsBackupsPage = observer(function UserConfig() {
	const navigate = useNavigate({ from: '/settings/backups' })

	const doEditRule = useCallback(
		(ruleId: string) => {
			void navigate({ to: `/settings/backups/${ruleId}` })
		},
		[navigate]
	)

	const createRuleMutation = useMutationExt(trpc.importExport.backupRules.createRule.mutationOptions())

	const doAddNew = useCallback(() => {
		createRuleMutation
			.mutateAsync({ name: 'New Backup Rule' })
			.then((ruleId) => {
				doEditRule(ruleId)
			})
			.catch((err) => {
				console.error('Error creating backup rule:', err)
			})
	}, [createRuleMutation, doEditRule])

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/settings/backups/$ruleId' })
	const selectedRuleId = routeMatch ? routeMatch.ruleId : null

	return (
		<div className="page-shell">
			<PageHeader icon={faCog} title="Settings" helpAction="/user-guide/config/settings#backups" />

			<SettingsNav activeTab="backups" />

			<SplitPanels.Root showing={selectedRuleId ? 'secondary' : 'primary'} resize={{ storageKey: 'backups' }}>
				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2">
						{/* Top Header Card: Toolbar */}
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex flex-col gap-2.5 shrink-0">
							<div className="flex flex-wrap items-center gap-2">
								<Button color="primary" size="sm" onClick={doAddNew}>
									<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add Backup Rule
								</Button>
							</div>
							<p className="text-xs text-muted mb-0">
								Automatically back up Companion configuration files on a schedule.
							</p>
						</div>

						<div className="flex-1 min-h-0 scrollable-content list-card p-2">
							<BackupsTable editRule={doEditRule} />
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

interface BackupsTableProps {
	editRule: (ruleId: string) => void
}

const BackupsTable = observer(function BackupsTable({ editRule }: BackupsTableProps) {
	const { userConfig } = useContext(RootAppStoreContext)

	const reorderRulesMutation = useMutationExt(trpc.importExport.backupRules.reorderRules.mutationOptions())

	const backupRules = userConfig.properties?.backups || []

	const moveRule = useCallback(
		(ruleId: string, targetId: string) => {
			reorderRulesMutation.mutateAsync({ ruleId, targetId }).catch((err) => {
				console.error('Error reordering backup rules:', err)
			})
		},
		[reorderRulesMutation]
	)

	useDragDropMonitor({
		onDragEnd(event) {
			if (event.canceled) return
			const { source } = event.operation
			if (!source || source.type !== 'backup-rule' || !isSortable(source)) return
			const { initialIndex, index } = source
			if (initialIndex === index) return
			const targetRule = backupRules[index]
			if (!targetRule) return
			moveRule(String(source.id), targetRule.id)
		},
	})

	return (
		<div className="space-y-1">
			{backupRules.length > 0 ? (
				backupRules.map((rule, index) => (
					<BackupsTableRow key={rule.id} rule={rule} index={index} editRule={editRule} />
				))
			) : (
				<div className="py-8">
					<NonIdealState icon={faAdd} text="No backup rules configured. Add one to get started!" />
				</div>
			)}
		</div>
	)
})

interface BackupsTableRowProps {
	rule: BackupRulesConfig
	index: number
	editRule: (ruleId: string) => void
}

function BackupsTableRow({ rule, index, editRule }: BackupsTableRowProps) {
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const updateRuleFieldMutation = useMutationExt(trpc.importExport.backupRules.updateRuleField.mutationOptions())
	const deleteRuleMutation = useMutationExt(trpc.importExport.backupRules.deleteRule.mutationOptions())

	const doEnableDisable = useCallback(
		(enabled: boolean) => {
			updateRuleFieldMutation.mutateAsync({ ruleId: rule.id, field: 'enabled', value: enabled }).catch((err) => {
				console.error('Error updating backup rule enabled state:', err)
			})
		},
		[updateRuleFieldMutation, rule.id]
	)

	const doDelete = useCallback(() => {
		confirmRef.current?.show(
			'Delete backup rule',
			'Are you sure you wish to delete this backup rule?',
			'Delete',
			() => {
				deleteRuleMutation.mutateAsync({ ruleId: rule.id }).catch((err) => {
					console.error('Error deleting backup rule:', err)
				})
			}
		)
	}, [deleteRuleMutation, rule.id])

	const doEdit = useCallback(() => editRule(rule.id), [editRule, rule.id])

	const { ref, handleRef } = useSortable({ id: rule.id, index, type: 'backup-rule', accept: 'backup-rule' })

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/settings/backups/$ruleId' })
	const isSelected = routeMatch && routeMatch.ruleId === rule.id

	const backupTypeLabel = backupTypes.find((type) => type.id === rule.backupType)?.label || rule.backupType

	return (
		<div
			ref={ref}
			className={classNames(
				'flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors',
				isSelected
					? 'bg-primary/10 font-semibold text-primary border-l-4 border-l-primary rounded-l-none'
					: 'hover:bg-surface-muted/50 bg-transparent'
			)}
		>
			<div ref={handleRef} className="cursor-grab text-muted/60 hover:text-muted px-1">
				<FontAwesomeIcon icon={faSort} />
				<GenericConfirmModal ref={confirmRef} />
			</div>
			<div className={classNames('grow min-w-0', { 'opacity-60': !rule.enabled })} onClick={doEdit}>
				<b className="text-sm font-semibold text-body-strong truncate block">{rule.name}</b>
				<span className="text-xs text-muted/80 font-normal">Format: {backupTypeLabel}</span>
			</div>
			<div
				className={classNames('min-w-0 text-xs text-muted/80 hidden sm:block font-mono tabular-nums', {
					'opacity-60': !rule.enabled,
				})}
				onClick={doEdit}
			>
				<span>Cron: {rule.cron}</span>
				{rule.lastRan && (
					<span className="block text-2xs tabular-nums text-muted/70 font-sans">
						Last run: {dayjs(rule.lastRan).format('MM/DD HH:mm:ss')}
					</span>
				)}
			</div>
			<div className="shrink-0 flex items-center gap-2">
				<SwitchInputField
					id={undefined}
					value={rule.enabled}
					setValue={doEnableDisable}
					tooltip={rule.enabled ? 'Disable rule' : 'Enable rule'}
				/>
				<Button
					color="secondary"
					size="sm"
					onClick={doDelete}
					title="Delete"
					className="text-rose-500 hover:bg-rose-500/10"
				>
					<FontAwesomeIcon icon={faTrash} />
				</Button>
			</div>
		</div>
	)
}
