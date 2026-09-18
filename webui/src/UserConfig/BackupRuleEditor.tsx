import { faClock, faPlay, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useId } from 'react'
import type { BackupRulesConfig, PreviousBackupInfo } from '@companion-app/shared/Model/UserConfigModel.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
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
				<Button
					color="secondary"
					size="sm"
					onClick={deleteBackup}
					title="Delete backup"
					className="text-rose-500 hover:bg-rose-500/10"
				>
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
		<div className="p-4 space-y-4">
			<div className="surface-card p-4 space-y-4">
				<div className="flex items-center justify-between gap-2 border-b border-border/70 pb-3">
					<div>
						<h4 className="text-sm font-bold text-body mb-0.5">Rule Configuration</h4>
						<p className="text-xs text-muted mb-0">Set rule name, schedule, and output destination.</p>
					</div>
					<Button color="warning" size="sm" onClick={runNow}>
						<FontAwesomeIcon icon={faPlay} className="me-1.5" />
						Run Now
					</Button>
				</div>

				<Form row className="gap-y-3">
					<FormLabel htmlFor={nameFieldId} sm={4} column="sm">
						Rule Name
					</FormLabel>
					<Grid.Col sm={8}>
						<TextInputFieldSimple id={nameFieldId} value={rule.name} setValue={(value) => updateField('name', value)} />
					</Grid.Col>

					<FormLabel htmlFor={cronFieldId} sm={4} column="sm">
						Cron Schedule
					</FormLabel>
					<Grid.Col sm={8}>
						<TextInputFieldSimple id={cronFieldId} value={rule.cron} setValue={(value) => updateField('cron', value)} />
						<small className="form-text text-muted block mt-1">
							Use cron syntax (e.g., <code className="text-2xs bg-surface-muted px-1 py-0.5 rounded">0 0 * * *</code>{' '}
							for daily at midnight). Use{' '}
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
					</Grid.Col>

					<FormLabel htmlFor={backupTypeFieldId} sm={4} column="sm">
						Backup Type
					</FormLabel>
					<Grid.Col sm={8}>
						<SimpleDropdownInputField
							id={backupTypeFieldId}
							value={rule.backupType}
							setValue={(value) => updateField('backupType', value as BackupRulesConfig['backupType'])}
							choices={backupTypes}
						/>
						{rule.backupType === 'db' && (
							<StaticAlert color="warning" className="mt-2 text-xs">
								Raw backups are a direct copy of the database file. They cannot be restored through the web interface,
								but contain more internal database data than standard exports.
							</StaticAlert>
						)}
					</Grid.Col>

					<FormLabel htmlFor={backupPathFieldId} sm={4} column="sm">
						Backup Path
					</FormLabel>
					<Grid.Col sm={8}>
						<TextInputFieldSimple
							id={backupPathFieldId}
							value={rule.backupPath}
							setValue={(value) => updateField('backupPath', value)}
						/>
						<small className="form-text text-muted block mt-1">
							Directory path where backups will be saved. Leave empty for default location.
						</small>
					</Grid.Col>

					<FormLabel htmlFor={backupNamePatternFieldId} sm={4} column="sm">
						Backup Name Pattern
					</FormLabel>
					<Grid.Col sm={8}>
						<TextInputField
							id={backupNamePatternFieldId}
							value={rule.backupNamePattern}
							setValue={(value) => updateField('backupNamePattern', value)}
							useVariables
						/>
					</Grid.Col>

					<FormLabel htmlFor={keepFieldId} sm={4} column="sm">
						Retention Count
					</FormLabel>
					<Grid.Col sm={8}>
						<NumberInputField
							id={keepFieldId}
							value={rule.keep}
							min={1}
							setValue={(value) => updateField('keep', value)}
						/>
						<small className="form-text text-muted block mt-1">
							Number of backup files to retain before automatically purging older backups.
						</small>
					</Grid.Col>
				</Form>
			</div>

			<div className="surface-card p-4">
				<div className="flex items-center gap-2 border-b border-border/70 pb-3 mb-3">
					<FontAwesomeIcon icon={faClock} className="text-muted text-xs" />
					<h4 className="text-sm font-bold text-body mb-0">Previous Backups</h4>
					<span className="text-2xs text-muted ms-auto">{rule.previousBackups?.length ?? 0} saved</span>
				</div>

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
			</div>
		</div>
	)
})
