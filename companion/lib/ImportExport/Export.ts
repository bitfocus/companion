/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import os from 'os'
import { getTimestamp, isFalsey } from '../Resources/Util.js'
import { ParseControlId } from '@companion-app/shared/ControlId.js'
import archiver from 'archiver'
import path from 'path'
import fs from 'fs'
import yaml from 'yaml'
import zlib from 'node:zlib'
import { stringify as csvStringify } from 'csv-stringify/sync'
import LogController, { Logger } from '../Log/Controller.js'
import type express from 'express'
import type { ParsedQs } from 'qs'
import type {
	ExportFullv6,
	ExportInstancesv6,
	ExportPageContentv6,
	ExportPageModelv6,
	ExportTriggerContentv6,
	ExportTriggersListv6,
	SomeExportv6,
} from '@companion-app/shared/Model/ExportModel.js'
import type { ImageLibraryExportData } from '@companion-app/shared/Model/ImageLibraryModel.js'
import type { AppInfo } from '../Registry.js'
import type { PageModel } from '@companion-app/shared/Model/PageModel.js'
import type { ClientExportSelection } from '@companion-app/shared/Model/ImportExport.js'
import type { ControlTrigger } from '../Controls/ControlTypes/Triggers/Trigger.js'
import type { ExportFormat } from '@companion-app/shared/Model/ExportFormat.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { SurfaceController } from '../Surface/Controller.js'
import { compileUpdatePayload } from '../UI/UpdatePayload.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { RequestHandler } from 'express'
import { FILE_VERSION } from './Constants.js'
import type { ClientSocket } from '../UI/Handler.js'
import type { TriggerCollection } from '@companion-app/shared/Model/TriggerModel.js'
import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'

export class ExportController {
	readonly #logger = LogController.createLogger('ImportExport/Controller')

	readonly #appInfo: AppInfo
	readonly #controlsController: ControlsController
	readonly #graphicsController: GraphicsController
	readonly #instancesController: InstanceController
	readonly #pagesController: PageController
	readonly #surfacesController: SurfaceController
	readonly #userConfigController: DataUserConfig
	readonly #variablesController: VariablesController

	constructor(
		appInfo: AppInfo,
		apiRouter: express.Router,
		controls: ControlsController,
		graphics: GraphicsController,
		instance: InstanceController,
		page: PageController,
		surfaces: SurfaceController,
		userconfig: DataUserConfig,
		variablesController: VariablesController
	) {
		this.#appInfo = appInfo
		this.#controlsController = controls
		this.#graphicsController = graphics
		this.#instancesController = instance
		this.#pagesController = page
		this.#surfacesController = surfaces
		this.#userConfigController = userconfig
		this.#variablesController = variablesController

		// Setup the API routes
		apiRouter.get('/export/triggers/all', this.#exportTriggerListHandler)
		apiRouter.get('/export/triggers/single/:id', this.#exportTriggerSingleHandler)
		apiRouter.get('/export/page/:page', this.#exportPageSingleHandler)
		apiRouter.get('/export/custom', this.#exportCustomHandler)
		apiRouter.get('/export/full', this.#exportFullHandler)
		apiRouter.get('/export/log', this.#exportLogHandler)
		apiRouter.get('/export/support', this.#exportSupportBundleHandler)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(_client: ClientSocket): void {
		// Noop
	}

	#exportTriggerListHandler: RequestHandler = (req, res, next) => {
		const triggerControls = this.#controlsController.getAllTriggers()
		const exp = this.#generateTriggersExport(triggerControls, true)

		const filename = this.#generateFilename(String(req.query.filename as any), 'trigger_list', 'companionconfig')

		downloadBlob(this.#logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
	}

	#exportTriggerSingleHandler: RequestHandler = (req, res, next) => {
		const control = this.#controlsController.getTrigger(req.params.id)
		if (control) {
			const exp = this.#generateTriggersExport([control], false)

			const triggerName = control.options.name.toLowerCase().replace(/\W/, '')
			const filename = this.#generateFilename(
				String(req.query.filename as any),
				`trigger_${triggerName}`,
				'companionconfig'
			)

			downloadBlob(this.#logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
		} else {
			next()
		}
	}

	#exportPageSingleHandler: RequestHandler = (req, res, next) => {
		const page = Number(req.params.page)
		if (isNaN(page)) {
			next()
		} else {
			const pageInfo = this.#pagesController.getPageInfo(page, true)
			if (!pageInfo) throw new Error(`Page "${page}" not found!`)

			const referencedConnectionIds = new Set<string>()
			const referencedConnectionLabels = new Set<string>()
			const referencedVariables = new Set<string>()

			const pageExport = this.#generatePageExportInfo(
				pageInfo,
				referencedConnectionIds,
				referencedConnectionLabels,
				referencedVariables
			)

			// Collect referenced connections and  collections
			const instancesExport = this.#generateReferencedConnectionConfigs(
				referencedConnectionIds,
				referencedConnectionLabels
			)
			const referencedConnectionCollectionIds = this.#collectReferencedCollectionIds(Object.values(instancesExport))
			const filteredConnectionCollections = this.#filterReferencedCollections(
				this.#instancesController.collections.collectionData,
				referencedConnectionCollectionIds
			)

			// Collect referenced image library items and collections
			const referencedImages = this.#collectReferencedImages(referencedVariables)
			const referencedImageLibraryCollectionIds = this.#collectReferencedCollectionIds(
				referencedImages.map((img) => img.info)
			)
			const filteredImageLibraryCollections = this.#filterReferencedCollections(
				this.#graphicsController.imageLibrary.exportCollections(),
				referencedImageLibraryCollectionIds
			)

			// Export file protocol version
			const exp: ExportPageModelv6 = {
				version: FILE_VERSION,
				type: 'page',
				companionBuild: this.#appInfo.appBuild,
				page: pageExport,
				instances: instancesExport,
				connectionCollections: filteredConnectionCollections,
				oldPageNumber: page,
				imageLibrary: referencedImages,
				imageLibraryCollections: filteredImageLibraryCollections,
			}

			const filename = this.#generateFilename(String(req.query.filename as any), `page${page}`, 'companionconfig')

			downloadBlob(this.#logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
		}
	}

	#exportCustomHandler: RequestHandler = (req, res, next) => {
		const exp = this.#generateCustomExport(req.query as any)

		const filename = this.#generateFilename(String(req.query.filename as any), '', 'companionconfig')

		downloadBlob(this.#logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
	}

	#exportFullHandler: RequestHandler = (req, res, next) => {
		const exp = this.#generateCustomExport(null)

		const filename = this.#generateFilename(
			String(this.#userConfigController.getKey('default_export_filename')),
			'full_config',
			'companionconfig'
		)

		downloadBlob(this.#logger, res, next, exp, filename, parseDownloadFormat(req.query.format))
	}

	#exportLogHandler: RequestHandler = (_req, res, _next) => {
		const logs = LogController.getAllLines()

		const filename = this.#generateFilename(
			String(this.#userConfigController.getKey('default_export_filename')),
			'companion_log',
			'csv'
		)

		res.status(200)
		res.set({
			'Content-Type': 'text/csv',
			'Content-Disposition': attachmentWithFilename(filename),
		})

		const csvOut = csvStringify([
			['Date', 'Module', 'Type', 'Log'],
			...logs.map((line) => [new Date(line.time).toISOString(), line.source, line.level, line.message]),
		])

		res.end(csvOut)
	}

	#exportSupportBundleHandler: RequestHandler = async (_req, res, _next) => {
		// Export support zip
		const archive = archiver('zip', { zlib: { level: 9 } })

		archive.on('error', (err) => {
			console.log(err)
		})

		//on stream closed we can end the request
		archive.on('end', () => {
			this.#logger.debug(`Support export wrote ${+archive.pointer()} bytes`)
		})

		//set the archive name
		const filename = this.#generateFilename(
			String(this.#userConfigController.getKey('default_export_filename')),
			'companion-config',
			'zip'
		)
		res.attachment(filename)

		//this is the streaming magic
		archive.pipe(res)

		archive.glob(
			'*',
			{
				cwd: this.#appInfo.configDir,
				nodir: true,
				ignore: [
					'cloud', // Ignore companion-cloud credentials
				],
			},
			{}
		)

		// Add the logs if found
		const logsDir = path.join(this.#appInfo.configDir, '../logs')
		if (fs.existsSync(logsDir)) {
			archive.glob(
				'*',
				{
					cwd: logsDir,
					nodir: true,
				},
				{
					prefix: 'logs',
				}
			)
		}

		{
			const logs = LogController.getAllLines()

			let out = `"Date","Module","Type","Log"\r\n`
			for (const line of logs) {
				out += `${new Date(line.time).toISOString()},"${line.source}","${line.level}","${line.message}"\r\n`
			}

			archive.append(out, { name: 'log.csv' })
		}

		try {
			const payload = compileUpdatePayload(this.#appInfo)
			const out = JSON.stringify(payload)
			archive.append(out, { name: 'user.json' })
		} catch (e) {
			this.#logger.debug(`Support bundle append user: ${e}`)
		}

		await archive.finalize()
	}

	//Parse variables and generate filename based on export type
	#generateFilename(filename: string, exportType: string, fileExt: string): string {
		//If the user isn't using their default file name, don't append any extra info in file name since it was a manual choice
		const useDefault = filename == this.#userConfigController.getKey('default_export_filename')
		const parser = this.#variablesController.values.createVariablesAndExpressionParser(null, null, null)
		const parsedName = parser.parseVariables(filename).text

		return parsedName && parsedName !== 'undefined'
			? `${parsedName}${exportType && useDefault ? '_' + exportType : ''}.${fileExt}`
			: `${os.hostname()}_${getTimestamp()}_${exportType}.${fileExt}`
	}

	#generateTriggersExport(triggerControls: ControlTrigger[], includeCollections: boolean): ExportTriggersListv6 {
		const triggersExport: ExportTriggerContentv6 = {}
		const referencedConnectionIds = new Set<string>()
		const referencedConnectionLabels = new Set<string>()
		const referencedVariables = new Set<string>()
		const referencedCollectionIds = new Set<string>()

		for (const control of triggerControls) {
			const parsedId = ParseControlId(control.controlId)
			if (parsedId?.type === 'trigger') {
				triggersExport[parsedId.trigger] = control.toJSON(false)

				control.collectReferencedConnectionsAndVariables(
					referencedConnectionIds,
					referencedConnectionLabels,
					referencedVariables
				)

				// Collect referenced collection IDs
				if (control.options.collectionId) {
					referencedCollectionIds.add(control.options.collectionId)
				}
			}
		}

		// Filter collections to only include those explicitly referenced or their parents
		const allTriggerCollections = includeCollections ? this.#controlsController.exportTriggerCollections() : []
		const triggerCollections: TriggerCollection[] = includeCollections
			? this.#filterReferencedCollections(allTriggerCollections, referencedCollectionIds)
			: []

		// Collect referenced connection and collections
		const instancesExport = this.#generateReferencedConnectionConfigs(
			referencedConnectionIds,
			referencedConnectionLabels
		)
		const referencedConnectionCollectionIds = this.#collectReferencedCollectionIds(Object.values(instancesExport))
		const filteredConnectionCollections = this.#filterReferencedCollections(
			this.#instancesController.collections.collectionData,
			referencedConnectionCollectionIds
		)

		// Collect referenced image library items and collections
		const referencedImages = this.#collectReferencedImages(referencedVariables)
		const referencedImageLibraryCollectionIds = this.#collectReferencedCollectionIds(
			referencedImages.map((img) => img.info)
		)
		const filteredImageLibraryCollections = this.#filterReferencedCollections(
			this.#graphicsController.imageLibrary.exportCollections(),
			referencedImageLibraryCollectionIds
		)

		const result: ExportTriggersListv6 = {
			type: 'trigger_list',
			version: FILE_VERSION,
			companionBuild: this.#appInfo.appBuild,
			triggers: triggersExport,
			triggerCollections: triggerCollections,
			instances: instancesExport,
			connectionCollections: filteredConnectionCollections,
			imageLibrary: referencedImages,
			imageLibraryCollections: filteredImageLibraryCollections,
		}

		return result
	}

	/**
	 * Filter collections to only include those explicitly referenced by items,
	 * or any parent collections of those which are referenced.
	 * This ensures we don't export unnecessary collections but maintain the collection hierarchy.
	 *
	 * @param allCollections - All available collections
	 * @param referencedCollectionIds - Set of collection IDs that are actually referenced by items
	 * @returns Filtered collections array with shallow cloning to avoid mutation
	 */
	#filterReferencedCollections<T>(
		allCollections: CollectionBase<T>[],
		referencedCollectionIds: Set<string>
	): CollectionBase<T>[] {
		if (referencedCollectionIds.size === 0) {
			return []
		}

		const filterCollections = (collections: CollectionBase<T>[]): CollectionBase<T>[] => {
			return collections
				.map((collection) => {
					const shouldIncludeSelf = referencedCollectionIds.has(collection.id)

					const childCollections = filterCollections(collection.children)

					if (shouldIncludeSelf || childCollections.length > 0) {
						return {
							...collection,
							children: childCollections,
						}
					} else {
						return null
					}
				})
				.filter((collection) => !!collection)
		}

		return filterCollections(allCollections)
	}

	#generateReferencedConnectionConfigs(
		referencedConnectionIds: Set<string>,
		referencedConnectionLabels: Set<string>,
		minimalExport = false
	): ExportInstancesv6 {
		const instancesExport: ExportInstancesv6 = {}

		referencedConnectionIds.delete('internal') // Ignore the internal module
		for (const connectionId of referencedConnectionIds) {
			instancesExport[connectionId] = this.#instancesController.exportInstance(connectionId, minimalExport)
		}

		referencedConnectionLabels.delete('internal') // Ignore the internal module
		for (const label of referencedConnectionLabels) {
			const connectionId = this.#instancesController.getIdForLabel(label)
			if (connectionId) {
				instancesExport[connectionId] = this.#instancesController.exportInstance(connectionId, minimalExport)
			}
		}

		return instancesExport
	}

	#generatePageExportInfo(
		pageInfo: PageModel,
		referencedConnectionIds: Set<string>,
		referencedConnectionLabels: Set<string>,
		referencedVariables: Set<string>
	): ExportPageContentv6 {
		const pageExport: ExportPageContentv6 = {
			name: pageInfo.name,
			controls: {},
			gridSize: this.#userConfigController.getKey('gridSize'),
		}

		for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
			for (const [column, controlId] of Object.entries(rowObj)) {
				const control = this.#controlsController.getControl(controlId)
				if (controlId && control && control.type !== 'trigger') {
					if (!pageExport.controls[Number(row)]) pageExport.controls[Number(row)] = {}
					pageExport.controls[Number(row)][Number(column)] = control.toJSON(false)

					control.collectReferencedConnectionsAndVariables(
						referencedConnectionIds,
						referencedConnectionLabels,
						referencedVariables
					)
				}
			}
		}

		return pageExport
	}

	#generateCustomExport(config: ClientExportSelection | null): ExportFullv6 {
		// Export file protocol version
		const exp: ExportFullv6 = {
			version: FILE_VERSION,
			type: 'full',
			companionBuild: this.#appInfo.appBuild,
		}

		const rawControls = this.#controlsController.getAllControls()

		const referencedConnectionIds = new Set<string>()
		const referencedConnectionLabels = new Set<string>()
		const referencedVariables = new Set<string>()

		if (!config || !isFalsey(config.buttons)) {
			exp.pages = {}

			const pageInfos = this.#pagesController.getAll()
			for (const [pageNumber, rawPageInfo] of Object.entries(pageInfos)) {
				exp.pages[Number(pageNumber)] = this.#generatePageExportInfo(
					rawPageInfo,
					referencedConnectionIds,
					referencedConnectionLabels,
					referencedVariables
				)
			}
		}

		if (!config || !isFalsey(config.triggers)) {
			const triggersExport: ExportTriggerContentv6 = {}
			for (const control of rawControls.values()) {
				if (control.type === 'trigger') {
					const parsedId = ParseControlId(control.controlId)
					if (parsedId?.type === 'trigger') {
						triggersExport[parsedId.trigger] = control.toJSON(false)

						control.collectReferencedConnectionsAndVariables(
							referencedConnectionIds,
							referencedConnectionLabels,
							referencedVariables
						)
					}
				}
			}
			exp.triggers = triggersExport

			exp.triggerCollections = this.#controlsController.exportTriggerCollections()
		}

		if (!config || !isFalsey(config.customVariables)) {
			exp.custom_variables = this.#variablesController.custom.getDefinitions()
			exp.customVariablesCollections = this.#variablesController.custom.exportCollections()
		}

		if (!config || !isFalsey(config.connections)) {
			// TODO: whether to include secrets should be configurable. Perhaps these should be encrypted too?
			exp.instances = this.#instancesController.exportAll(false)
			exp.connectionCollections = this.#instancesController.collections.collectionData
		} else {
			exp.instances = this.#generateReferencedConnectionConfigs(
				referencedConnectionIds,
				referencedConnectionLabels,
				true
			)

			const referencedConnectionCollectionIds = this.#collectReferencedCollectionIds(Object.values(exp.instances))
			exp.connectionCollections = this.#filterReferencedCollections(
				this.#instancesController.collections.collectionData,
				referencedConnectionCollectionIds
			)
		}

		if (!config || !isFalsey(config.surfaces)) {
			exp.surfaces = this.#surfacesController.exportAll()
			exp.surfaceGroups = this.#surfacesController.exportAllGroups()
		}

		// Handle image library export
		if (!config || !isFalsey(config.imageLibrary)) {
			exp.imageLibrary = this.#graphicsController.imageLibrary.exportImageLibraryData()
			exp.imageLibraryCollections = this.#graphicsController.imageLibrary.exportCollections()
		}

		return exp
	}

	/**
	 * Collect referenced images from variable references
	 */
	#collectReferencedImages(referencedVariables: Set<string>): ImageLibraryExportData[] {
		const referencedImages: ImageLibraryExportData[] = []

		// Get all images and create a map for efficient lookup
		const allImages = this.#graphicsController.imageLibrary.exportImageLibraryData()
		const imageMap = new Map<string, ImageLibraryExportData>()
		for (const imageData of allImages) {
			imageMap.set(imageData.info.name, imageData)
		}

		// Look for image variables in the format "image:imageId"
		for (const variable of referencedVariables) {
			// Variable names that start with 'image:' are image references
			if (variable.startsWith('image:')) {
				const imageName = variable.substring(6) // Remove 'image:' prefix

				const imageData = imageMap.get(imageName)
				if (imageData) {
					referencedImages.push(imageData)
				}
			}
		}

		return referencedImages
	}

	#collectReferencedCollectionIds<TItem extends { collectionId?: string }>(items: TItem[]): Set<string> {
		const referencedCollectionIds = new Set<string>()
		for (const item of items) {
			if (item.collectionId) {
				referencedCollectionIds.add(item.collectionId)
			}
		}
		return referencedCollectionIds
	}
}

function parseDownloadFormat(raw: ParsedQs[0]): ExportFormat | undefined {
	if (raw === 'json-gz' || raw === 'json' || raw === 'yaml') return raw
	return undefined
}

/**
 * Replacer that splits "png64" values into multiple lines.
 *
 * These are base64 encoded PNGs and can get very long. A length of 60 characters is used to allow
 * for indentation in the YAML.
 *
 * @param key - The key of the value being processed.
 * @param value - The value to be processed.
 * @returns The modified value or the original value if the conditions are not met.
 */
function splitLongPng64Values(key: string, value: string): string {
	if (key === 'png64' && typeof value === 'string' && value.length > 60) {
		return btoa(atob(value)).replace(/(.{60})/g, '$1\n') + '\n'
	}
	return value
}

/**
 * Compute a Content-Disposition header specifying an attachment with the
 * given filename.
 */
function attachmentWithFilename(filename: string): string {
	function quotedAscii(s: string): string {
		// Boil away combining characters and non-ASCII code points and escape
		// quotes.  Modern browsers don't use this, so don't bother going all-out.
		// Don't percent-encode anything, because browsers don't agree on whether
		// quoted filenames should be percent-decoded (Firefox and Chrome yes,
		// Safari no).
		return (
			'"' +
			[...s.normalize('NFKD')]
				.filter((c) => '\x20' <= c && c <= '\x7e')
				.map((c) => (c === '"' || c === '\\' ? '\\' : '') + c)
				.join('') +
			'"'
		)
	}

	// The filename parameter is used primarily by legacy browsers.  Strangely, it
	// must be present for at least some versions of Safari to use the modern
	// filename* parameter.
	const quotedFallbackAsciiFilename = quotedAscii(filename)
	const modernUnicodeFilename = encodeURIComponent(filename)
	return `attachment; filename=${quotedFallbackAsciiFilename}; filename*=UTF-8''${modernUnicodeFilename}`
}

function downloadBlob(
	logger: Logger,
	res: express.Response,
	next: express.NextFunction,
	data: SomeExportv6,
	filename: string,
	format: ExportFormat | undefined
): void {
	if (!format || format === 'json-gz') {
		zlib.gzip(JSON.stringify(data), (err, result) => {
			if (err) {
				logger.warn(`Failed to gzip data, retrying uncompressed: ${err}`)
				downloadBlob(logger, res, next, data, filename, 'json')
			} else {
				res.status(200)
				res.set({
					'Content-Type': 'application/gzip',
					'Content-Disposition': attachmentWithFilename(filename),
				})
				res.end(result)
			}
		})
	} else if (format === 'json') {
		res.status(200)
		res.set({
			'Content-Type': 'application/json',
			'Content-Disposition': attachmentWithFilename(filename),
		})
		res.end(JSON.stringify(data, undefined, '\t'))
	} else if (format === 'yaml') {
		res.status(200)
		res.set({
			'Content-Type': 'application/yaml',
			'Content-Disposition': attachmentWithFilename(filename),
		})
		res.end(yaml.stringify(data, splitLongPng64Values))
	} else {
		next(new Error(`Unknown format: ${format}`))
	}
}
