import { useDragDropMonitor } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { faAdd, faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import dayjs from 'dayjs'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import type { BackupRulesConfig } from '@companion-app/shared/Model/UserConfigModel.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { Grid } from '~/Components/Grid'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { ContextHelpButton } from '~/Layout/PanelIcons.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { NonIdealState } from '../Components/NonIdealState.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { backupTypes } from './BackupConstants.js'

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
		// Create the new rule using the dedicated endpoint
		createRuleMutation
			.mutateAsync({ name: 'New Backup Rule' })
			.then((ruleId) => {
				// Navigate to the new rule for editing
				doEditRule(ruleId)
			})
			.catch((err) => {
				console.error('Error creating backup rule:', err)
			})
	}, [createRuleMutation, doEditRule])

	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/settings/backups/$ruleId' })
	const selectedRuleId = routeMatch ? routeMatch.ruleId : null

	const showPrimaryPanel = !selectedRuleId
	const showSecondaryPanel = !!selectedRuleId

	return (
		<Grid.Row className="split-panels">
			<Grid.Col xs={12} xl={6} className={`primary-panel ${showPrimaryPanel ? '' : 'd-xl-block d-none'}`}>
				<div className="flex-column-layout">
					<div className="fixed-header">
						<div className="d-flex justify-content-between">
							<div>
								<h4 className="button-inline">
									Settings - Backups
									<ContextHelpButton action="/user-guide/config/settings#backups">
										Companion can back itself up on a schedule to multiple directories if desired. These backups can be
										synced to cloud storage or backed up during OS backup to give more peace of mind to administrators.
									</ContextHelpButton>
								</h4>
								<p>Scheduled backups of your Companion configuration. Settings apply instantaneously!</p>
							</div>
						</div>

						<div className="mb-2">
							<ButtonGroup>
								<Button color="primary" onClick={doAddNew} size="sm">
									<FontAwesomeIcon icon={faAdd} /> Add Backup Rule
								</Button>
							</ButtonGroup>
						</div>
					</div>

					<div className="scrollable-content">
						<BackupsTable editRule={doEditRule} />
					</div>
				</div>
			</Grid.Col>

			<Grid.Col xs={12} xl={6} className={`secondary-panel ${showSecondaryPanel ? '' : 'd-xl-block d-none'}`}>
				<div className="secondary-panel-simple">
					<Outlet />
				</div>
			</Grid.Col>
		</Grid.Row>
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
			const { source, target } = event.operation
			// Only handle backup-rule drags (the provider is shared across the whole app)
			if (!source || !target || source.type !== 'backup-rule') return
			const sourceId = String(source.id)
			const targetId = String(target.id)
			if (sourceId === targetId) return
			moveRule(sourceId, targetId)
		},
	})

	return (
		<div className="collections-nesting-table" style={{ marginBottom: 10 }}>
			{backupRules.length > 0 ? (
				backupRules.map((rule, index) => (
					<BackupsTableRow key={rule.id} rule={rule} index={index} editRule={editRule} />
				))
			) : (
				<div className="currentlyNone">
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
			// Toggle the enabled state using the dedicated endpoint
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
			className={classNames('collections-nesting-table-row-item', {
				'row-selected': isSelected,
			})}
		>
			<div className="collections-nesting-table-row-item-grid">
				<div ref={handleRef} className="row-reorder-handle">
					<FontAwesomeIcon icon={faSort} />
					<GenericConfirmModal ref={confirmRef} />
				</div>
				<div className="grow backup-rule-content">
					<div onClick={doEdit} className="hand backup-rule-info">
						<b>{rule.name}</b>
						<br />
						<small>Format: {backupTypeLabel}</small>
					</div>
					<div onClick={doEdit} className="hand backup-rule-cron">
						<small>Cron: {rule.cron}</small>
						<br />
						{rule.lastRan ? <small>Last run: {dayjs(rule.lastRan).format('MM/DD HH:mm:ss')}</small> : ''}
					</div>
					<div className="backup-rule-actions">
						<ButtonGroup>
							<SwitchInputField
								id={undefined}
								value={rule.enabled}
								setValue={doEnableDisable}
								tooltip={rule.enabled ? 'Disable rule' : 'Enable rule'}
							/>

							<Button onClick={doDelete} title="Delete">
								<FontAwesomeIcon icon={faTrash} />
							</Button>
						</ButtonGroup>
					</div>
				</div>
			</div>
		</div>
	)
}
