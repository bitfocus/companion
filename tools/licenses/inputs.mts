import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Metafile } from 'esbuild'

/**
 * Every bundler used by the distribution build records which files ended up in its output here, so that the license
 * inventory can be assembled from all of them at the end of the build. Kept outside `dist` so it is never shipped.
 */
const licenseInputsDir = path.resolve(import.meta.dirname, '../../.cache/license-inputs')

export interface RecordedBundleInputs {
	/** Absolute paths of the source files which contributed bytes to the bundle */
	inputs: string[]
	/** Inputs which could not be attributed to a file on disk, reported alongside the inventory */
	diagnostics: string[]
}

/** Discards what a previous build recorded, so a stale bundle can never leak into this build's inventory */
export async function clearRecordedBundleInputs(): Promise<void> {
	await rm(licenseInputsDir, { recursive: true, force: true })
}

export async function recordBundleInputs(name: string, recorded: RecordedBundleInputs): Promise<void> {
	await mkdir(licenseInputsDir, { recursive: true })
	await writeFile(path.join(licenseInputsDir, `${name}.json`), JSON.stringify(recorded, undefined, 2))
}

/** Everything recorded by this build, merged and deduplicated, with each source named in its diagnostics */
export async function readRecordedBundleInputs(): Promise<RecordedBundleInputs> {
	let entries: string[]
	try {
		entries = await readdir(licenseInputsDir)
	} catch {
		throw new Error(`No bundle inputs were recorded in ${licenseInputsDir}. Run the distribution build first.`)
	}

	const inputs = new Set<string>()
	const diagnostics: string[] = []
	for (const entry of entries.sort()) {
		if (!entry.endsWith('.json')) continue
		const recorded: RecordedBundleInputs = JSON.parse(await readFile(path.join(licenseInputsDir, entry), 'utf8'))
		for (const input of recorded.inputs) inputs.add(input)
		for (const diagnostic of recorded.diagnostics) diagnostics.push(`${path.basename(entry, '.json')}: ${diagnostic}`)
	}
	if (!inputs.size)
		throw new Error(`No bundle inputs were recorded in ${licenseInputsDir}. Run the distribution build first.`)
	return { inputs: [...inputs], diagnostics }
}

/**
 * esbuild reports the inputs of each output relative to its absWorkingDir, and names the ones it synthesised rather
 * than read from disk (such as `<stdin>`) in angle brackets.
 */
export function bundleInputsFromMetafile(metafile: Metafile, absWorkingDir: string): RecordedBundleInputs {
	const inputs: string[] = []
	const diagnostics: string[] = []
	for (const [outputPath, output] of Object.entries(metafile.outputs)) {
		if (!outputPath.endsWith('.js')) continue
		for (const [inputPath, input] of Object.entries(output.inputs)) {
			if (input.bytesInOutput <= 0) continue
			if (inputPath.startsWith('<')) diagnostics.push(`Ignoring virtual esbuild input: ${inputPath}`)
			else inputs.push(path.resolve(absWorkingDir, inputPath))
		}
	}
	return { inputs: [...new Set(inputs)], diagnostics: [...new Set(diagnostics)] }
}
