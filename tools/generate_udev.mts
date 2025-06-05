import { UdevRuleGenerator, UdevRuleDefinition } from 'udev-generator'
import { readdir, writeFile } from 'fs/promises'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
import vecFootpedal from 'vec-footpedal'
import { readFileSync } from 'fs'

const require = createRequire(import.meta.url)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ConfigForPlugin {
	npmPackage?: string
	npmPackageFile?: string
	manualRules?: UdevRuleDefinition[]
}

// Future - over time this should be replaced with being fed from better sources, instead of being a separate hardcoded list
// Perhaps with a small refactor, some of the usb ids to surface plugin name could be moved to a static map that can be used here?
const generatorConfig: Record<string, ConfigForPlugin> = {
	ElgatoStreamDeck: {
		npmPackage: '@elgato-stream-deck/node',
	},
	LoupedeckLive: {
		// No rules needed for serialports
	},
	LoupedeckCt: {
		// No rules needed for serialports
	},
	BlackmagicController: {
		npmPackage: '@blackmagic-controller/node',
	},
	XKeys: {
		// npmPackage: 'xkeys',
		// npmPackageFile: 'README.md',
		manualRules: [
			{
				vendorId: 0x05f3,
				productIds: null,
			},
		],
	},
	Infinitton: {
		// npmPackage: 'infinitton-idisplay',
		manualRules: [
			{
				vendorId: 0xffff,
				productIds: [0x1f40, 0x1f41],
			},
		],
	},
	ContourShuttle: {
		// npmPackage: 'shuttle-node',
		manualRules: [
			{
				vendorId: 0x0b33,
				productIds: [0x0010, 0x0020, 0x0030],
			},
		],
	},
	VECFootpedal: {
		// npmPackage: 'vec-footpedal',
		manualRules: [
			{
				vendorId: vecFootpedal.vids.VEC,
				productIds: [vecFootpedal.pids.FOOTPEDAL],
			},
		],
	},
	FrameworkMacropad: {
		// No npm package - uses node-hid directly
		manualRules: [
			{
				vendorId: 0x32ac,
				productIds: [0x0013],
			},
		],
	},
	'203SystemsMystrix': {
		// No npm package - uses node-hid directly
		manualRules: [
			{
				vendorId: 0x0203,
				productIds: null, // This is not ideal, but the code is unclear what it should be
			},
		],
	},
	MiraboxStreamDock: {
		// No npm package - uses node-hid directly
		manualRules: [
			{
				vendorId: 0x6602,
				productIds: null,
			},
			{
				vendorId: 0x6603,
				productIds: null,
			},
		],
	},
	Util: {
		// Ignore file
	},
}

const generator = new UdevRuleGenerator()

console.log('Generating udev rules...')

// List files in /companion/lib/Surface/USB
const usbSurfacesPath = path.resolve(__dirname, '../companion/lib/Surface/USB')
const files = await readdir(usbSurfacesPath)

// For each file, check what the generatorConfig defines should be generated and pass it to the generator
for (const file of files) {
	if (!file.endsWith('.ts')) continue

	const basename = file.replace('.ts', '')
	const config = generatorConfig[basename]

	if (!config) {
		console.warn(`No configuration found for ${basename}`)
		continue
	}

	if (config.npmPackage) {
		console.log(`Adding rules for ${basename} (${config.npmPackage})`)

		const packagePath = require.resolve(
			path.join(config.npmPackage, config.npmPackageFile || 'udev-generator-rules.json')
		)
		console.log(`Using package path: ${packagePath}`)
		if (config.npmPackageFile) {
			generator.addFileContents(readFileSync(packagePath, 'utf8'))
		} else {
			generator.addRules(require(packagePath))
			// generator.addPackage(config.npmPackage)
		}
	}

	if (config.manualRules) {
		console.log(`Adding manual rules for ${basename}`)
		generator.addRules(config.manualRules)
	}
}

// Generate rules for desktop and headless environments
const desktopRules = generator.generateFile({
	mode: 'desktop',
})
const headlessRules = generator.generateFile({
	mode: 'headless',
	userGroup: 'companion',
})

// Rewrite the files at /assets/linux/*.rules
const assetsLinuxPath = path.resolve(__dirname, '../assets/linux')

await writeFile(path.join(assetsLinuxPath, '50-companion-desktop.rules'), desktopRules, 'utf8')
await writeFile(path.join(assetsLinuxPath, '50-companion-headless.rules'), headlessRules, 'utf8')

console.log('✅ udev rules generated successfully!')
