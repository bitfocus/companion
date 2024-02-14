#!/usr/bin/env node

// Setup some fixes before loading any imports
import './lib/Util/FixImports.js'

// Setup logging before anything else runs
import './lib/Log/Controller.js'

// Now we can think about startup
import { Command } from 'commander'
import Registry from './lib/Registry.js'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import envPaths from 'env-paths'
import { nanoid } from 'nanoid'
import logger from './lib/Log/Controller.js'
import { ConfigReleaseDirs } from '../launcher/Paths.cjs'

const program = new Command()

program.command('check-launches', { hidden: true }).action(() => {
	// This is a 'test' command used to make sure builds are able to run
	console.log('It launches!')
	process.exit(89)
})

program
	.option('--list-interfaces', 'List the available network interfaces that can be passed to --admin-interface')
	.option('--admin-port <number>', 'Set the port the admin ui should bind to', 8000)
	.option(
		'--admin-interface <string>',
		'Set the interface the admin ui should bind to. The first ip on this interface will be used'
	)
	.option('--admin-address <string>', 'Set the ip address the admin ui should bind to (default: "0.0.0.0")')
	.option(
		'--config-dir <string>',
		'Use the specified directory for storing configuration. The default path varies by system, and is different to 2.2 (the old path will be used if existing config is found)'
	)
	.option('--extra-module-path <string>', 'Search an extra directory for modules to load')
	.option('--machine-id <string>', 'Unique id for this installation')
	.option('--log-level <string>', 'Log level to output to console')

program.command('start', { isDefault: true, hidden: true }).action(() => {
	const options = program.opts()

	if (options.listInterfaces) {
		console.error('Available Interfaces:')

		const interfaces = os.networkInterfaces()
		for (const [ifname, ifgroup] of Object.entries(interfaces)) {
			for (const ifAddr of ifgroup) {
				// onlt show non-ipv4 addresses for now
				if ('IPv4' === ifAddr.family) {
					console.error(ifname, ifAddr.address)
				}
			}
		}

		process.exit(0)
	}

	logger.logger.info('Application starting')

	if (isNaN(options.adminPort)) {
		console.error(`Port number is not valid`)
		process.exit(1)
	}

	if (options.adminAddress && options.adminInterface) {
		console.error(`Only one of admin-interface and admin-address can be specified`)
		process.exit(1)
	}

	let adminIp = options.adminAddress || '0.0.0.0' // default to admin global

	if (options.adminInterface) {
		adminIp = null

		const interfaceInfo = os.networkInterfaces()[options.adminInterface]
		if (interfaceInfo) {
			for (const ifAddr of interfaceInfo) {
				// only show non-ipv4 addresses for now
				if ('IPv4' === ifAddr.family) {
					adminIp = ifAddr.address
					break
				}
			}
		}

		if (!adminIp) {
			console.error(`Invalid interface name "${options.adminInterface}"`)
			process.exit(1)
		}
	}

	let configDir = options.configDir
	if (!configDir) {
		// Check the old location first
		configDir = path.join(process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'], 'companion')
		if (!fs.pathExistsSync(configDir)) {
			// Creating a new folder, so use the proper place
			const paths = envPaths('companion')
			configDir = paths.config
		}
	}

	// some files are always in the root configDir
	const machineIdPath = path.join(configDir, 'machid')
	const readmePath = path.join(configDir, 'README.txt')

	// Handle the rename from `develop` to `v3.0`, setting up a link for backwards compatibility
	const developDir = path.join(configDir, 'develop')
	const v30Dir = path.join(configDir, 'v3.0')
	if (fs.existsSync(developDir) && !fs.existsSync(v30Dir)) {
		fs.moveSync(developDir, v30Dir)
		fs.symlinkSync(v30Dir, developDir, process.platform === 'win32' ? 'junction' : undefined)
	}

	// develop should use subfolder. This should be disabled when ready for mass testing
	const rootConfigDir = configDir
	configDir = path.join(configDir, ConfigReleaseDirs[ConfigReleaseDirs.length - 1])

	try {
		fs.ensureDirSync(configDir)
	} catch (e) {
		console.error(`Failed to create config directory. Do you have the correct permissions?`)
		process.exit(1)
	}

	// Make sure README file exists in the config dir
	if (!fs.existsSync(readmePath)) {
		fs.writeFileSync(
			readmePath,
			'Since Companion 3.0, each release your config gets put into a new folder.\n' +
				'This makes it much easier and safer to downgrade to older releases, as their configuration will be left untouched.\n' +
				"When launching a version whose folder doesn't yet exist, the config will be copied from one of the previous releases, looking in release order.\n" +
				'\n' +
				'The db file in this folder is used for 2.4 or older, use the appropriate folders for newer configs\n'
		)
	}

	// copy an older db if needed
	if (configDir !== rootConfigDir && !fs.existsSync(path.join(configDir, 'db'))) {
		// try and import the non-develop copy. we only need to take `db` for this
		for (let i = ConfigReleaseDirs.length - 1; i--; i >= 0) {
			const previousDbPath =
				i > 0 ? path.join(rootConfigDir, ConfigReleaseDirs[i], 'db') : path.join(rootConfigDir, 'db')
			if (fs.existsSync(previousDbPath)) {
				// Found the one to copy
				fs.copyFileSync(previousDbPath, path.join(configDir, 'db'))
				break
			}
		}
	}

	if (options.logLevel) {
		logger.setLogLevel(options.logLevel)
	}

	let machineId = options.machineId
	if (!machineId) {
		// Use stored value
		if (fs.pathExistsSync(machineIdPath)) {
			let text = ''
			try {
				text = fs.readFileSync(machineIdPath)
				if (text) {
					machineId = text.toString()
				}
			} catch (e) {
				console.warn(`Error reading machid file: ${e}`)
			}
		} else {
			machineId = nanoid()
			try {
				fs.writeFileSync(machineIdPath, machineId)
			} catch (e) {
				console.warn(`Error writing machid file: ${e}`)
			}
		}
	}

	const registry = new Registry(configDir, machineId)

	registry
		.ready(options.extraModulePath, adminIp, options.adminPort)
		.then(() => {
			console.log('Started')
		})
		.catch((e) => {
			console.error(`Startup failed: ${e} ${e.stack}`)
			process.exit(1)
		})
})

program.parse()
