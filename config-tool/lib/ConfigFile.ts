import fs from 'node:fs'
import path from 'node:path'
import { Document, Pair, parseDocument, YAMLMap } from 'yaml'
import { LAUNCH_OPTIONS, type LaunchOption } from '@companion-app/shared/LaunchOptions.js'
import { optionFileDefault } from './options.js'

const BANNER = [
	' Companion headless launch configuration.',
	'',
	' This file is read by the companion-pi launch tooling to start the headless server.',
	' It is safe to edit by hand - comments and formatting are preserved when the',
	' `config-tool` rewrites it. Unknown keys are left untouched.',
	'',
	' Remove a key (or set it to null) to fall back to the built-in default.',
].join('\n')

export class ConfigFile {
	readonly path: string
	readonly existed: boolean
	private readonly doc: Document

	private constructor(filePath: string, existed: boolean, doc: Document) {
		this.path = filePath
		this.existed = existed
		this.doc = doc
	}

	/** Load the config file, or start a new in-memory document if it does not exist yet. */
	static load(filePath: string): ConfigFile {
		if (fs.existsSync(filePath)) {
			const text = fs.readFileSync(filePath, 'utf8')
			const doc = parseDocument(text)
			// Empty or non-map document: start fresh (an empty file has no comments to preserve anyway)
			if (!(doc.contents instanceof YAMLMap)) {
				return new ConfigFile(filePath, true, new Document(new YAMLMap()))
			}
			return new ConfigFile(filePath, true, doc)
		}

		const doc = new Document(new YAMLMap())
		doc.commentBefore = BANNER
		return new ConfigFile(filePath, false, doc)
	}

	/** The raw value stored for an option key (undefined when absent). */
	get(key: string): unknown {
		return this.doc.get(key)
	}

	has(key: string): boolean {
		return this.doc.has(key)
	}

	/** Set the value for an option, preserving any existing comment on the key. Adds the option (with comment) if missing. */
	set(option: LaunchOption, value: string | number | boolean | null): void {
		if (this.doc.has(option.key)) {
			this.doc.set(option.key, value)
		} else {
			this.addWithComment(option, value)
		}
	}

	/**
	 * Add any managed options not already present, each annotated with its description comment.
	 * `seeds` provides initial values for newly-added options (used by install tooling to supply
	 * platform defaults); it never affects options already in the file.
	 */
	mergeMissingOptions(seeds: Record<string, string | number | boolean | null> = {}): string[] {
		const added: string[] = []
		for (const option of LAUNCH_OPTIONS) {
			if (this.doc.has(option.key)) continue
			const value = option.key in seeds ? seeds[option.key] : optionFileDefault(option)
			this.addWithComment(option, value)
			added.push(option.key)
		}
		return added
	}

	private addWithComment(option: LaunchOption, value: string | number | boolean | null): void {
		const map = this.doc.contents as YAMLMap
		const keyNode = this.doc.createNode(option.key)
		keyNode.commentBefore = ` ${option.short}`
		const valueNode = this.doc.createNode(value)
		map.add(new Pair(keyNode, valueNode))
	}

	serialize(): string {
		return this.doc.toString()
	}

	/** Write the document atomically (temp file in the same directory, then rename), preserving file mode. */
	write(): void {
		const dir = path.dirname(this.path)
		fs.mkdirSync(dir, { recursive: true })

		let mode = 0o644
		try {
			mode = fs.statSync(this.path).mode
		} catch {
			// new file - keep default mode
		}

		const tmpPath = path.join(dir, `.${path.basename(this.path)}.tmp`)
		fs.writeFileSync(tmpPath, this.serialize(), { mode })
		fs.renameSync(tmpPath, this.path)
	}
}
