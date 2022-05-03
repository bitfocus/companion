#!/usr/bin/env node
import meow from 'meow'
import Registry from './lib/Registry.js'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import envPaths from 'env-paths'
import shortid from 'shortid'

const cli = meow(
	`
	Usage
	  $ ./main.js 

	Examples
	  $ foo .
	  $ foo --admin-port 8000

	  TODO 
`,
	{
		importMeta: { url: import.meta.url },
		flags: {
			listInterfaces: {
				type: 'boolean',
				default: false,
			},
			adminPort: {
				type: 'number',
				default: 8000,
				// alias: 'r',
			},
			adminInterface: {
				type: 'string',
			},
			adminAddress: {
				type: 'string',
			},
			configDir: {
				type: 'string',
				// isRequired: (flags) => {
				// 	return !flags.listInterfaces
				// },
			},
			machineId: {
				type: 'string',
			},
		},
	}
)

if (cli.flags.listInterfaces) {
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

if (isNaN(cli.flags.adminPort)) {
	console.error(`Port number is not valid`)
	process.exit(1)
}

if (cli.flags.adminAddress && cli.flags.adminInterface) {
	console.error(`Only one of admin-interface and admin-address can be specified`)
	process.exit(1)
}

let adminIp = cli.flags.adminAddress || '0.0.0.0' // default to admin global

if (cli.flags.adminInterface) {
	adminIp = null

	const interfaceInfo = os.networkInterfaces()[cli.flags.adminInterface]
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
		console.error(`Invalid interface name "${cli.flags.adminInterface}"`)
		process.exit(1)
	}
}

let configDir = cli.flags.configDir
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

let machineId = cli.flags.machineId
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
			console.warn(`Error reading uuid-file: ${e}`)
		}
	} else {
		machineId = shortid.generate()
		try {
			fs.writeFileSync(machineIdPath, machineId)
		} catch (e) {
			console.warn(`Error writing uuid-file: ${e}`)
		}
	}
}

const registry = new Registry(configDir, machineId)

await registry.ready(adminIp, cli.flags.adminPort, !process.env.DEVELOPER)
console.log('Started')
