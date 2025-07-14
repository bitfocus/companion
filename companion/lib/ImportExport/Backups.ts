/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: Julian Waller <companion@julusian.co.uk>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 */

import LogController from '../Log/Controller.js'
import path from 'path'
import fs from 'fs/promises'
import nodeCron from 'node-cron'
import { nanoid } from 'nanoid'
import type { BackupRulesConfig, PreviousBackupInfo } from '@companion-app/shared/Model/UserConfigModel.js'
import type { AppInfo } from '../Registry.js'
import type { VariablesValues } from '../Variables/Values.js'
import type winston from 'winston'
import { stringifyExport } from './Util.js'
import { Logger } from 'winston'
import type { ExportFormat } from '@companion-app/shared/Model/ExportFormat.js'
import type { ExportController } from './Export.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import z from 'zod'

/**
 * BackupController handles scheduled backups of companion app data.
 */
export class BackupController {
	readonly #logger = LogController.createLogger('ImportExport/BackupController')

	readonly #db: DataDatabase
	readonly #userConfig: DataUserConfig
	readonly #variableValuesController: VariablesValues
	readonly #defaultBackupDir: string
	readonly #cronJobs: Map<string, nodeCron.ScheduledTask> = new Map()
	readonly #exportController: ExportController
	#backupRules: BackupRulesConfig[] = []

	/**
	 * Create a new backup controller
	 * @param appInfo Application information
	 * @param db Database instance (for raw backups)
	 * @param userConfig User configuration controller
	 * @param variableValuesController Variable values controller
	 * @param exportController Export controller
	 */
	constructor(
		appInfo: AppInfo,
		db: DataDatabase,
		userConfig: DataUserConfig,
		variableValuesController: VariablesValues,
		exportController: ExportController
	) {
		this.#db = db
		this.#userConfig = userConfig
		this.#variableValuesController = variableValuesController
		this.#defaultBackupDir = path.join(appInfo.configDir, 'backups')
		this.#exportController = exportController

		// Listen for config changes
		this.#userConfig.on('keyChanged', (key, value) => {
			if (key === 'backups') {
				this.#backupRules = value as BackupRulesConfig[]
				this.#scheduleBackups()
			}
		})
	}

	createTrpcRouter() {
		return router({
			runBackupNow: publicProcedure
				.input(
					z.object({
						ruleId: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					return this.runBackupNow(input.ruleId)
				}),

			deleteBackupFile: publicProcedure
				.input(
					z.object({
						ruleId: z.string(),
						filePath: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					return this.deleteBackup(input.ruleId, input.filePath)
				}),

			updateRuleField: publicProcedure
				.input(
					z.object({
						ruleId: z.string(),
						field: z.string(),
						value: z.unknown(),
					})
				)
				.mutation(async ({ input }) => {
					return this.updateRuleField(input.ruleId, input.field, input.value)
				}),

			createRule: publicProcedure
				.input(
					z.object({
						name: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					return this.createRule(input.name)
				}),
			deleteRule: publicProcedure
				.input(
					z.object({
						ruleId: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					return this.deleteRule(input.ruleId)
				}),
			reorderRules: publicProcedure
				.input(
					z.object({
						ruleId: z.string(),
						targetId: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					return this.reorderRules(input.ruleId, input.targetId)
				}),
		})
	}

	/**
	 * Run a specific backup rule immediately
	 * @param ruleId ID of the backup rule to run
	 */
	private async runBackupNow(ruleId: string): Promise<void> {
		const rule = this.#backupRules.find((r) => r.id === ruleId)
		if (!rule) {
			this.#logger.error(`Cannot run backup - rule with ID ${ruleId} not found`)
			throw new Error('Backup rule not found')
		}

		const logger = LogController.createLogger(`ImportExport/BackupController/${rule.name}`)

		logger.info(`Starting backup to: ${rule.backupPath || this.#defaultBackupDir}`)
		const backupInfo = await this.#createBackup(logger, rule)
		if (backupInfo) {
			// Update the last ran timestamp
			this.#updateLastRanTimestamp(rule.id, backupInfo)
			logger.info(`Manual backup created successfully: ${backupInfo.filePath} (${backupInfo.fileSize} bytes)`)
		} else {
			logger.error('Failed to create manual backup')
			throw new Error('No backup created')
		}
	}

	/**
	 * Update the last ran timestamp for a backup rule
	 * @param ruleId ID of the backup rule to update
	 */
	#updateLastRanTimestamp(ruleId: string, newBackupInfo: PreviousBackupInfo): void {
		const newBackupRules = [...this.#backupRules]
		const ruleIndex = newBackupRules.findIndex((r) => r.id === ruleId)

		if (ruleIndex !== -1) {
			const updatedRule: BackupRulesConfig = {
				...newBackupRules[ruleIndex],
				lastRan: Date.now(),
				previousBackups: [...newBackupRules[ruleIndex].previousBackups, newBackupInfo],
			}
			newBackupRules[ruleIndex] = updatedRule

			this.#userConfig.setKeyUnchecked('backups', newBackupRules)

			this.cleanupOldBackups(updatedRule).catch((err) => {
				this.#logger.error(`Failed to clean up old backups for rule ${ruleId}: ${err}`)
			})
		}
	}

	/**
	 * Initialize backup scheduler with user configuration
	 * @param backupRules Backup rules configuration object
	 */
	initializeWithConfig(backupRules: BackupRulesConfig[]): void {
		this.#ensureBackupDirExists().catch((err) => {
			this.#logger.error(`Failed to ensure backup directory exists: ${err}`)
		})

		this.#backupRules = backupRules
		this.#scheduleBackups()
	}

	/**
	 * Schedule all backup rules from configuration
	 */
	#scheduleBackups(): void {
		this.#clearScheduledJobs()

		// Create new jobs from current config
		for (const rule of this.#backupRules) {
			if (rule.enabled) {
				this.#scheduleBackup(rule)
			}
		}
	}

	/**
	 * Clear all scheduled backup jobs
	 */
	#clearScheduledJobs(): void {
		for (const [id, job] of this.#cronJobs.entries()) {
			Promise.resolve(job.stop()).catch((err) => {
				this.#logger.error(`Failed to stop cron job ${id}: ${err}`)
			})
			this.#cronJobs.delete(id)
		}
	}

	/**
	 * Schedule a single backup rule
	 * @param rule Backup rule configuration
	 */
	#scheduleBackup(rule: BackupRulesConfig): void {
		try {
			// Stop existing job if it exists
			const existingJob = this.#cronJobs.get(rule.id)
			if (existingJob) {
				Promise.resolve(existingJob.stop()).catch((err) => {
					this.#logger.error(`Failed to stop cron job ${rule.id}: ${err}`)
				})
				this.#cronJobs.delete(rule.id)
			}

			if (!nodeCron.validate(rule.cron)) {
				this.#logger.error(`Invalid cron expression for rule "${rule.name}": ${rule.cron}`)
				return
			}

			// Create new job
			const job = nodeCron.schedule(
				rule.cron,
				async () => {
					const logger = LogController.createLogger(`ImportExport/BackupController/${rule.name}`)
					try {
						logger.info(`Running scheduled backup for rule`)
						const backupInfo = await this.#createBackup(logger, rule)
						if (backupInfo) {
							this.#updateLastRanTimestamp(rule.id, backupInfo)
							logger.info(
								`Scheduled backup created successfully: ${backupInfo.filePath} (${backupInfo.fileSize} bytes)`
							)
						} else {
							logger.error(`Failed to create scheduled backup for rule`)
						}
					} catch (err) {
						logger.error(`Error in scheduled backup: ${err}`)
					}
				},
				{
					noOverlap: true,
				}
			)

			// Store the job
			this.#cronJobs.set(rule.id, job)
			this.#logger.info(`Scheduled backup rule: ${rule.name} with cron: ${rule.cron}`)
		} catch (err) {
			this.#logger.error(`Failed to schedule backup rule ${rule.name}: ${err}`)
		}
	}

	/**
	 * Clean up old backups based on keep count
	 * @param rule Backup rule configuration
	 */
	private async cleanupOldBackups(rule: BackupRulesConfig): Promise<void> {
		try {
			if (rule.keep <= 0 || !rule.previousBackups || rule.previousBackups.length <= rule.keep) {
				// No cleanup needed
				return
			}

			// Sort backups by creation time (newest first)
			const sortedBackups = [...rule.previousBackups].sort((a, b) => b.createdAt - a.createdAt)

			// Identify backups to delete (keep only the newest 'keep' count)
			const backupsToDelete = sortedBackups.slice(rule.keep)
			if (backupsToDelete.length === 0) return

			this.#logger.info(`Cleaning up ${backupsToDelete.length} old backups for rule ${rule.name}`)

			// Delete the old backup files
			const deletionPromises = backupsToDelete.map(async (backup) => {
				try {
					await fs.unlink(backup.filePath)
					this.#logger.info(`Deleted old backup: ${backup.filePath}`)
					return backup
				} catch (err) {
					this.#logger.warn(`Failed to delete backup file ${backup.filePath}: ${err}`)
					// Return null to indicate this backup wasn't deleted
					return null
				}
			})

			const deletionResults = await Promise.all(deletionPromises)

			// Update the rule's previousBackups list to remove successfully deleted backups
			// Note: this needs to lookup the list again, as the original array may have been modified during the delete
			const updatedPreviousBackups = rule.previousBackups.filter(
				(backup) => !deletionResults.some((deleted) => deleted && deleted.filePath === backup.filePath)
			)

			// Update the rule in the configuration if any backups were deleted
			if (updatedPreviousBackups.length !== rule.previousBackups.length) {
				const updatedBackupRules = [...this.#backupRules]
				const ruleIndex = updatedBackupRules.findIndex((r) => r.id === rule.id)

				if (ruleIndex !== -1) {
					updatedBackupRules[ruleIndex] = {
						...updatedBackupRules[ruleIndex],
						previousBackups: updatedPreviousBackups,
					}

					// Update the userConfig
					this.#userConfig.setKeyUnchecked('backups', updatedBackupRules)
					this.#backupRules = updatedBackupRules
				}
			}
		} catch (err) {
			this.#logger.error(`Failed to clean up old backups for rule ${rule.name}: ${err}`)
		}
	}

	/**
	 * Ensure backup directory exists
	 */
	async #ensureBackupDirExists(): Promise<void> {
		try {
			await fs.mkdir(this.#defaultBackupDir, { recursive: true })
		} catch (e) {
			this.#logger.error('Failed to create backup directory', e)
		}
	}

	/**
	 * Check if a file already exists and throw an error if it does
	 * @param filePath Path to check for existence
	 * @throws Error if file already exists or if there's an access error other than ENOENT
	 */
	async #ensureFileDoesNotExist(filePath: string): Promise<void> {
		try {
			await fs.access(filePath)
			// File exists, this is an error
			throw new Error(`Backup file already exists: ${filePath}`)
		} catch (err) {
			// File doesn't exist (ENOENT error), which is what we want
			if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
				// Some other error occurred
				throw err
			}
		}
	}

	/**
	 * Create a backup of the current configuration
	 * @param rule Configuration for the backup
	 * @returns Promise resolving to the backup filename or null if failed
	 */
	async #createBackup(logger: winston.Logger, rule: BackupRulesConfig): Promise<PreviousBackupInfo | null> {
		try {
			await this.#ensureBackupDirExists()

			// Determine backup directory - use rule path if specified, otherwise default
			const backupDir = rule.backupPath ? rule.backupPath : this.#defaultBackupDir
			await fs.mkdir(backupDir, { recursive: true })

			// Generate backup filename
			const parser = this.#variableValuesController.createVariablesAndExpressionParser(null, null, null)
			const backupName = parser.parseVariables(rule.backupNamePattern)
			if (!backupName) {
				logger.info('No backup name generated, skipping backup')
				return null
			}

			// Create the backup based on type
			switch (rule.backupType) {
				case 'db': {
					const filePath = path.join(backupDir, `${backupName.text}.companiondb`)

					// Check if file already exists
					await this.#ensureFileDoesNotExist(filePath)

					logger.info(`Creating database backup at ${filePath}`)

					const fileSize = await this.#db.createBackup(filePath)

					return {
						filePath,
						fileSize,
						createdAt: Date.now(),
					}
				}

				case 'export-gz':
					return this.#generateExportBackup(logger, backupDir, backupName.text, 'json-gz')
				case 'export-json':
					return this.#generateExportBackup(logger, backupDir, backupName.text, 'json')
				case 'export-yaml':
					return this.#generateExportBackup(logger, backupDir, backupName.text, 'yaml')

				default:
					throw new Error(`Unsupported backup type: ${rule.backupType}`)
			}
		} catch (err: any) {
			logger.error(`Failed to create backup: ${err}`)
			throw new Error(`Failed to create backup: ${err.message || err}`)
		}
	}

	async #generateExportBackup(
		logger: Logger,
		backupDir: string,
		filename: string,
		format: ExportFormat
	): Promise<PreviousBackupInfo> {
		const data = this.#exportController.generateCustomExport(null)
		const exportData = await stringifyExport(logger, data, `${filename}.companionconfig`, format)
		if (!exportData) throw new Error('Failed to stringify export data')

		const filePath = path.join(backupDir, exportData.utf8Filename)

		await this.#ensureFileDoesNotExist(filePath)

		logger.info(`Exporting to ${filePath}`)

		await fs.writeFile(filePath, exportData.data)

		return {
			filePath,
			fileSize: exportData.data.length,
			createdAt: Date.now(),
		}
	}

	/**
	 * Delete a backup file
	 * @param ruleId ID of the backup rule that owns this backup
	 * @param filePath Path to the backup file to delete
	 * @returns Promise resolving to true if deletion was successful
	 */
	async deleteBackup(ruleId: string, filePath: string): Promise<boolean> {
		try {
			// Find the rule and verify the backup exists in its previousBackups list
			const rule = this.#backupRules.find((r) => r.id === ruleId)
			if (!rule) {
				this.#logger.warn(`Backup rule not found: ${ruleId}`)
				return false
			}

			const backupIndex = rule.previousBackups.findIndex((backup) => backup.filePath === filePath)
			if (backupIndex === -1) {
				this.#logger.warn(`Backup file not found in rule ${ruleId}: ${filePath}`)
				return false
			}

			// Delete the file if it exists
			try {
				await fs.unlink(filePath)
				this.#logger.info(`Deleted backup file: ${filePath}`)
			} catch (err) {
				this.#logger.warn(`Failed to delete backup file ${filePath}, but will remove from rule: ${err}`)
			}

			// Update backup rules to remove this backup from the specific rule
			const updatedBackupRules = [...this.#backupRules]
			const updatedRule = updatedBackupRules.find((r) => r.id === ruleId)
			if (updatedRule) {
				updatedRule.previousBackups.splice(backupIndex, 1)

				// Update the userConfig through the database
				this.#userConfig.setKeyUnchecked('backups', updatedBackupRules)
				this.#backupRules = updatedBackupRules
			}

			return true
		} catch (e) {
			this.#logger.error(`Failed to delete backup file ${filePath}:`, e)
			return false
		}
	}

	/**
	 * Validate a field update for a backup rule
	 * @param field The field name to update
	 * @param value The value to set
	 * @returns Validation result with success status and error message
	 */
	#validateFieldUpdate(field: string, value: unknown): { valid: boolean; error?: string } {
		// Type validation for each field
		switch (field) {
			case 'name':
			case 'backupPath':
			case 'backupNamePattern':
				if (typeof value !== 'string') {
					return { valid: false, error: `Field '${field}' must be a string, got ${typeof value}` }
				}
				if (field === 'name' && value.trim().length === 0) {
					return { valid: false, error: 'Name cannot be empty' }
				}
				break

			case 'cron':
				if (typeof value !== 'string') {
					return { valid: false, error: `Field '${field}' must be a string, got ${typeof value}` }
				}
				if (!nodeCron.validate(value)) {
					return { valid: false, error: `Field '${field}' must be a valid cron expression, got '${value}'` }
				}
				break

			case 'enabled':
				if (typeof value !== 'boolean') {
					return { valid: false, error: `Field '${field}' must be a boolean, got ${typeof value}` }
				}
				break

			case 'keep':
				if (!Number.isInteger(value) || (value as number) < 0) {
					return { valid: false, error: `Field '${field}' must be a non-negative integer, got ${value}` }
				}
				if ((value as number) > 1000) {
					return { valid: false, error: `Field '${field}' cannot exceed 1000 backups, got ${value}` }
				}
				break

			case 'backupType': {
				const validBackupTypes = ['db', 'export-gz', 'export-json', 'export-yaml']
				if (typeof value !== 'string' || !validBackupTypes.includes(value)) {
					return {
						valid: false,
						error: `Field '${field}' must be one of: ${validBackupTypes.join(', ')}, got ${value}`,
					}
				}
				break
			}

			default:
				return { valid: false, error: `Unknown field: ${field}` }
		}

		return { valid: true }
	}

	/**
	 * Update a specific field in a backup rule
	 * @param ruleId ID of the rule to update
	 * @param field Field name to update
	 * @param value New value for the field
	 * @returns Promise resolving to true if update was successful
	 */
	async updateRuleField(ruleId: string, field: string, value: unknown): Promise<boolean> {
		try {
			const updatedBackupRules = [...this.#backupRules]
			const ruleIndex = updatedBackupRules.findIndex((r) => r.id === ruleId)

			if (ruleIndex === -1) {
				this.#logger.warn(`Backup rule not found for update: ${ruleId}`)
				return false
			}

			// Validate the field name and value type
			const validationResult = this.#validateFieldUpdate(field, value)
			if (!validationResult.valid) {
				this.#logger.warn(`Invalid field update for backup rule: ${validationResult.error}`)
				return false
			}

			// Update the field
			updatedBackupRules[ruleIndex] = {
				...updatedBackupRules[ruleIndex],
				[field]: value,
			}

			// Update the userConfig through the UserConfig controller
			this.#userConfig.setKeyUnchecked('backups', updatedBackupRules)
			this.#backupRules = updatedBackupRules

			// Reschedule if the rule was updated
			this.#scheduleBackups()

			this.#logger.info(`Updated backup rule ${ruleId} field ${field}`)
			return true
		} catch (e) {
			this.#logger.error(`Failed to update backup rule ${ruleId} field ${field}:`, e)
			return false
		}
	}

	/**
	 * Create a new backup rule
	 * @param name Name for the new backup rule
	 * @returns Promise resolving to the new rule ID if creation was successful
	 */
	async createRule(name: string): Promise<string> {
		try {
			const newRuleId = nanoid()
			const newRule: BackupRulesConfig = {
				id: newRuleId,
				name: name || 'New Backup Rule',
				cron: '0 0 * * *', // Daily at midnight
				enabled: true,
				keep: 5,
				backupType: 'db',
				backupPath: '', // Default to empty, will use default backup directory
				backupNamePattern: 'backup-$(internal:hostname)_$(internal:date_iso)-$(internal:time_h)$(internal:time_m)',
				lastRan: 0,
				previousBackups: [],
			}

			const updatedBackupRules = [...this.#backupRules, newRule]

			// Update the userConfig through the UserConfig controller
			this.#userConfig.setKeyUnchecked('backups', updatedBackupRules)
			this.#backupRules = updatedBackupRules

			// Reschedule backups
			this.#scheduleBackups()

			this.#logger.info(`Created backup rule: ${newRule.name} (${newRuleId})`)
			return newRuleId
		} catch (e) {
			this.#logger.error(`Failed to create backup rule:`, e)
			throw new Error('Failed to create backup rule')
		}
	}

	/**
	 * Delete a backup rule
	 * @param ruleId ID of the rule to delete
	 * @returns Promise resolving to true if deletion was successful
	 */
	async deleteRule(ruleId: string): Promise<boolean> {
		try {
			const ruleIndex = this.#backupRules.findIndex((r) => r.id === ruleId)

			if (ruleIndex === -1) {
				this.#logger.warn(`Backup rule not found for deletion: ${ruleId}`)
				return false
			}

			const updatedBackupRules = [...this.#backupRules]
			const deletedRule = updatedBackupRules.splice(ruleIndex, 1)[0]

			// Update the userConfig through the UserConfig controller
			this.#userConfig.setKeyUnchecked('backups', updatedBackupRules)
			this.#backupRules = updatedBackupRules

			// Remove any scheduled job for this rule
			const job = this.#cronJobs.get(ruleId)
			if (job) {
				Promise.resolve(job.stop()).catch((err) => {
					this.#logger.error(`Failed to stop cron job ${ruleId}: ${err}`)
				})
				this.#cronJobs.delete(ruleId)
			}

			this.#logger.info(`Deleted backup rule: ${deletedRule.name} (${ruleId})`)
			return true
		} catch (e) {
			this.#logger.error(`Failed to delete backup rule ${ruleId}:`, e)
			return false
		}
	}

	/**
	 * Reorder backup rules by moving one rule to another position
	 * @param ruleId ID of the rule to move
	 * @param targetId ID of the rule to move next to
	 * @returns Promise<boolean> Success status
	 */
	async reorderRules(ruleId: string, targetId: string): Promise<boolean> {
		try {
			const rules = [...this.#backupRules]
			const itemIndex = rules.findIndex((rule) => rule.id === ruleId)
			const targetIndex = rules.findIndex((rule) => rule.id === targetId)

			if (itemIndex === -1 || targetIndex === -1) {
				this.#logger.warn(`Cannot reorder: rule not found. itemId=${ruleId}, targetId=${targetId}`)
				return false
			}

			// Remove the item
			const [movedItem] = rules.splice(itemIndex, 1)
			// Insert at the target position
			rules.splice(targetIndex, 0, movedItem)

			// Update the userConfig through the UserConfig controller
			this.#userConfig.setKeyUnchecked('backups', rules)
			this.#backupRules = rules

			this.#logger.info(`Reordered backup rules: moved ${ruleId} to position near ${targetId}`)
			return true
		} catch (e) {
			this.#logger.error(`Failed to reorder backup rules: ${ruleId} -> ${targetId}:`, e)
			return false
		}
	}
}
