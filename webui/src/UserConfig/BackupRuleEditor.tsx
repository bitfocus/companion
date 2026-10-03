import { faPlay, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useId } from 'react'
import type { BackupRulesConfig, PreviousBackupInfo } from '@companion-app/shared/Model/UserConfigModel.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { Table } from '~/Components/Table.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { NumberInputField } from '../Components/NumberInputField.js'
import { TextInputField, TextInputFieldSimple } from '../Components/TextInputField.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { backupTypes } from './BackupConstants.js'

interface PreviousBackupRowProps {
	backup: PreviousBackupInfo
	ruleId: string
}

const PreviousBackupRow = observer(function PreviousBackupRow({ backup, ruleId }: PreviousBackupRowProps) {
	const { notifier } = useContext(RootAppStoreContext)

	const deleteBackupFileMutation = useMutationExt(trpc.importExport.backupRules.deleteBackupFile.mutationOptions())

	const deleteBackup = useCallback(() => {
		if (confirm('Are you sure you want to delete this backup file?')) {
			deleteBackupFileMutation.mutateAsync({ ruleId, filePath: backup.filePath }).catch((err) => {
				console.error('Error deleting backup:', err)
				notifier.show('Error', `Failed to delete backup file: ${err.message || err}`, 5000)
			})
		}
	}, [deleteBackupFileMutation, notifier, ruleId, backup.filePath])

	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return '0 Bytes'
		const k = 1024
		const sizes = ['Bytes', 'KB', 'MB', 'GB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
	}

	const getFileName = (filePath: string): string => {
		return filePath.split('/').pop() || filePath
	}

	return (
		<tr className="hover:bg-surface-hover/60 transition-colors">
			<td className="py-2.5 px-3">
				<div title={getFileName(backup.filePath)} className="font-medium text-body text-xs truncate max-w-xs">
					{getFileName(backup.filePath)}
				</div>
				<div className="text-2xs text-muted mt-0.5">
					{new Date(backup.createdAt).toLocaleString()} •{' '}
					<span className="font-mono">{formatFileSize(backup.fileSize)}</span>
				</div>
			</td>
			<td className="whitespace-nowrap align-middle py-2.5 px-3 text-right">
				<Button color="danger" size="sm" onClick={deleteBackup} title="Delete backup" variant="ghost">
					<FontAwesomeIcon icon={faTrash} />
				</Button>
			</td>
		</tr>
	)
})

interface BackupRuleEditorProps {
	ruleId: string
}

export const BackupRuleEditor = observer(function BackupRuleEditor({ ruleId }: BackupRuleEditorProps) {
	const { userConfig, notifier } = useContext(RootAppStoreContext)

	const updateRuleFieldMutation = useMutationExt(trpc.importExport.backupRules.updateRuleField.mutationOptions())
	const runBackupNowMutation = useMutationExt(trpc.importExport.backupRules.runBackupNow.mutationOptions())

	// Find the rule in the config
	const rule = userConfig.properties?.backups?.find((r) => r.id === ruleId)

	// Function to update a specific field in the rule
	const updateField = useCallback(
		<K extends keyof BackupRulesConfig>(field: K, value: BackupRulesConfig[K]) => {
			updateRuleFieldMutation.mutateAsync({ ruleId, field, value }).catch((err) => {
				console.error('Error updating backup rule field:', err)
			})
		},
		[updateRuleFieldMutation, ruleId]
	)

	// Function to run the backup rule immediately
	const runNow = useCallback(() => {
		runBackupNowMutation
			.mutateAsync({ ruleId })
			.then(() => {
				notifier.show('Success', 'Backup created successfully', 3000)
			})
			.catch((err) => {
				console.error('Error running backup now:', err)
				notifier.show('Error', `${err.message || err || 'Failed to create backup'}`, 5000)
			})
	}, [runBackupNowMutation, notifier, ruleId])

	const nameFieldId = useId()
	const cronFieldId = useId()
	const backupTypeFieldId = useId()
	const backupPathFieldId = useId()
	const backupNamePatternFieldId = useId()
	const keepFieldId = useId()

	// If no rule found, show message
	if (!rule) {
		return <StaticAlert color="warning">Backup rule not found</StaticAlert>
	}

	const previousBackups = [...(rule.previousBackups || [])].sort((a, b) => b.createdAt - a.createdAt)

	return (
		<div className="edit-panel">
			<EditSectionCard title="Rule Configuration">
				<div className="flex items-center justify-between gap-2">
					<p className="text-xs text-muted mb-0">Set rule name, schedule, and output destination.</p>
					<Button color="secondary" size="sm" onClick={runNow}>
						<FontAwesomeIcon icon={faPlay} className="me-1.5" />
						Run Now
					</Button>
				</div>

				<div className="edit-field-row">
					<label htmlFor={nameFieldId} className="text-xs font-semibold text-body">
						Rule Name
					</label>
					<div className="min-w-0">
						<TextInputFieldSimple id={nameFieldId} value={rule.name} setValue={(value) => updateField('name', value)} />
					</div>
				</div>

				<div className="edit-field-row">
					<label htmlFor={cronFieldId} className="text-xs font-semibold text-body">
						Cron Schedule
					</label>
					<div className="min-w-0">
						<TextInputFieldSimple id={cronFieldId} value={rule.cron} setValue={(value) => updateField('cron', value)} />
					</div>
					<small className="edit-field-help form-text text-muted block">
						Use cron syntax (e.g., <code className="text-2xs bg-surface-muted px-1 py-0.5 rounded">0 0 * * *</code> for
						daily at midnight). Use{' '}
						<a
							href="https://crontab.guru"
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							crontab guru
						</a>{' '}
						for help generating expressions.
					</small>
				</div>

				<div className="edit-field-row">
					<label htmlFor={backupTypeFieldId} className="text-xs font-semibold text-body">
						Backup Type
					</label>
					<div className="min-w-0">
						<SimpleDropdownInputField
							id={backupTypeFieldId}
							value={rule.backupType}
							setValue={(value) => updateField('backupType', value as BackupRulesConfig['backupType'])}
							choices={backupTypes}
						/>
					</div>
					{rule.backupType === 'db' && (
						<StaticAlert color="warning" className="edit-field-help text-xs">
							Raw backups are a direct copy of the database file. They cannot be restored through the web interface, but
							contain more internal database data than standard exports.
						</StaticAlert>
					)}
				</div>

				<div className="edit-field-row">
					<label htmlFor={backupPathFieldId} className="text-xs font-semibold text-body">
						Backup Path
					</label>
					<div className="min-w-0">
						<TextInputFieldSimple
							id={backupPathFieldId}
							value={rule.backupPath}
							setValue={(value) => updateField('backupPath', value)}
						/>
					</div>
					<small className="edit-field-help form-text text-muted block">
						Directory path where backups will be saved. Leave empty for default location.
					</small>
				</div>

				<div className="edit-field-row">
					<label htmlFor={backupNamePatternFieldId} className="text-xs font-semibold text-body">
						Backup Name Pattern
					</label>
					<div className="min-w-0">
						<TextInputField
							id={backupNamePatternFieldId}
							value={rule.backupNamePattern}
							setValue={(value) => updateField('backupNamePattern', value)}
							useVariables
						/>
					</div>
				</div>

				<div className="edit-field-row">
					<label htmlFor={keepFieldId} className="text-xs font-semibold text-body">
						Retention Count
					</label>
					<div className="min-w-0">
						<NumberInputField
							id={keepFieldId}
							value={rule.keep}
							min={1}
							setValue={(value) => updateField('keep', value)}
						/>
					</div>
					<small className="edit-field-help form-text text-muted block">
						Number of backup files to retain before automatically purging older backups.
					</small>
				</div>
			</EditSectionCard>

			<EditSectionCard title="Previous Backups" summary={`${previousBackups.length} saved`}>
				{rule.previousBackups && rule.previousBackups.length > 0 ? (
					<div className="overflow-hidden rounded-lg border border-border/70">
						<Table size="sm" className="mb-0">
							<tbody className="divide-y divide-border/60">
								{previousBackups.map((backup) => (
									<PreviousBackupRow key={`${backup.filePath}-${backup.createdAt}`} backup={backup} ruleId={ruleId} />
								))}
							</tbody>
						</Table>
					</div>
				) : (
					<div className="text-xs text-muted text-center py-4 italic">
						No backup files found yet. Backups will appear here as the rule runs.
					</div>
				)}
			</EditSectionCard>
		</div>
	)
})
