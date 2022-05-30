#!/usr/bin/env node

// Setup logging before anything else runs
import Logging from './lib/Log/Controller.js'

// Now we can think about startup
import { Command } from 'commander'
import Registry from './lib/Registry.js'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import envPaths from 'env-paths'
import { nanoid } from 'nanoid'
import logger from './lib/Log/Controller.js'

const program = new Command()

program
	.option('--list-interfaces', 'List the available network interfaces that can be passed to --admin-interface')
	.option('--admin-port <number>', 'Set the port the admin ui should bind to (default: 8000)', 8000)
	.option(
		'--admin-interface <string>',
		"Set the interface the admin ui should bind to. The first ip on this interface will be used (default: '')"
	)
	.option('--admin-address <string>', 'Set the ip address the admin ui should bind to (default: 0.0.0.0)', '0.0.0.0')
	.option(
		'--config-dir <string>',
		'Use the specified directory for storing configuration. The default path varies by system, and is different to 2.2 (the old path will be used if existing config is found)'
	)
	.option('--extra-module-path <string>', 'Search an extra directory for modules to load')

program.parse()

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
	configDir = path.join(
		process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'],
		'companion-REMOVE-THIS-SUFFIX-BEFORE-ITS-BETA'
	)
	if (!fs.pathExistsSync(configDir)) {
		// Creating a new folder, so use the proper place
		const paths = envPaths('companion')
		configDir = paths.config
	}
}

try {
	fs.ensureDirSync(configDir)
} catch (e) {
	console.error(`Failed to create config directory. Do you have the correct permissions?`)
	process.exit(1)
}

if (options.logToFile) {
	Logging.setupLogToFile(configDir)
}

let machineId = options.machineId
if (!machineId) {
	// Use stored value
	const machineIdPath = path.join(configDir, 'machid')
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
