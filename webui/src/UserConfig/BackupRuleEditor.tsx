import React, { useCallback, useContext } from 'react'
import { CAlert, CButton, CCol, CForm, CFormLabel, CFormSelect, CInputGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { BackupRulesConfig, PreviousBackupInfo } from '@companion-app/shared/Model/UserConfigModel.js'
import { TextInputField } from '../Components/TextInputField.js'
import { NumberInputField } from '../Components/NumberInputField.js'
import { backupTypes } from './BackupConstants.js'
import { trpc, useMutationExt } from '~/TRPC.js'

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
				notifier.current?.show('Error', `Failed to delete backup file: ${err.message || err}`, 5000)
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
		<tr>
			<td>
				<span
					title={getFileName(backup.filePath)}
					style={{
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
						fontWeight: 500,
					}}
				>
					{getFileName(backup.filePath)}
				</span>
				<br />
				<small>
					{new Date(backup.createdAt).toLocaleString()} • {formatFileSize(backup.fileSize)}
				</small>
			</td>
			<td className="no-wrap" style={{ verticalAlign: 'middle' }}>
				<CButton color="danger" size="sm" onClick={deleteBackup} title="Delete backup">
					<FontAwesomeIcon icon={faTrash} />
				</CButton>
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
				notifier.current?.show('Success', 'Backup created successfully', 3000)
			})
			.catch((err) => {
				console.error('Error running backup now:', err)
				notifier.current?.show('Error', `${err.message || err || 'Failed to create backup'}`, 5000)
			})
	}, [runBackupNowMutation, notifier, ruleId])

	// If no rule found, show message
	if (!rule) {
		return <CAlert color="warning">Backup rule not found</CAlert>
	}

	const previousBackups = [...(rule.previousBackups || [])].sort((a, b) => b.createdAt - a.createdAt)

	return (
		<CForm className="p-3 row g-3">
			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Rule Name</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<CInputGroup>
					<TextInputField value={rule.name} setValue={(value) => updateField('name', value)} />
					<CButton color="warning" onClick={runNow}>
						Run Now
					</CButton>
				</CInputGroup>
			</CCol>

			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Cron Schedule</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<TextInputField value={rule.cron} setValue={(value) => updateField('cron', value)} />
				<small className="form-text text-muted">
					Use cron syntax (e.g., "0 0 * * *" for daily at midnight). You can use{' '}
					<a href="https://crontab.guru" target="_blank" rel="noopener noreferrer">
						crontab guru
					</a>{' '}
					to help you generate the correct syntax.
				</small>
			</CCol>

			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Backup Type</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<CFormSelect
					value={rule.backupType}
					onChange={(e) => updateField('backupType', e.target.value as BackupRulesConfig['backupType'])}
				>
					{backupTypes.map((type) => (
						<option key={type.value} value={type.value}>
							{type.label}
						</option>
					))}
				</CFormSelect>
			</CCol>
			{rule.backupType === 'db' && (
				<CCol sm={12}>
					<CAlert color="warning" className="mt-2">
						Raw backups are a direct copy of the database file. They cannot be restored through the web interface, but
						contain more data than the default exports.
					</CAlert>
				</CCol>
			)}

			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Backup Path</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<TextInputField value={rule.backupPath} setValue={(value) => updateField('backupPath', value)} />
				<small className="form-text text-muted">
					Directory path where backups will be saved. Leave empty for default location.
				</small>
			</CCol>

			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Backup Name Pattern</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<TextInputField
					value={rule.backupNamePattern}
					setValue={(value) => updateField('backupNamePattern', value)}
					useVariables
				/>
			</CCol>

			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Number of Backups to Keep</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<NumberInputField value={rule.keep} min={1} setValue={(value) => updateField('keep', value)} />
				<small className="form-text text-muted">How many backup files to retain before deleting the oldest ones</small>
			</CCol>

			<CCol sm={12}>
				<label className="form-label">Previous Backups</label>
				{rule.previousBackups && rule.previousBackups.length > 0 && (
					<div className="table-responsive">
						<table className="table table-sm table-striped">
							<tbody>
								{previousBackups.map((backup) => (
									<PreviousBackupRow key={`${backup.filePath}-${backup.createdAt}`} backup={backup} ruleId={ruleId} />
								))}
							</tbody>
						</table>
					</div>
				)}

				{(!rule.previousBackups || rule.previousBackups.length === 0) && (
					<div className="text-muted">
						<small>No backup files found. Backups may have been manually deleted or moved.</small>
					</div>
				)}
			</CCol>
		</CForm>
	)
})
