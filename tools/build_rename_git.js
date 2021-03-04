//
// This file is part of the Companion project
// Copyright (c) 2018 Bitfocus AS
// Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
//
// This program is free software.
// You should have received a copy of the MIT licence as well as the Bitfocus
// Individual Contributor License Agreement for companion along with
// this program.
//
// You can be released from the requirements of the license by purchasing
// a commercial license. Buying such a license is mandatory as soon as you
// develop commercial activities involving the Companion software without
// disclosing the source code of your own applications.
//
const fs = require('fs-extra')
const { spawn } = require('child_process')

function exec(command, args) {
	let data = ''
	let errdata = ''

	return new Promise((resolve, reject) => {
		const child = spawn(command, args)
		child.stdout.on('data', (output) => {
			data += output
		})
		child.stderr.on('data', (output) => {
			errdata += output
		})
		child.on('exit', (code, signal) => {
			if (code !== 0) {
				return reject(`Command ${command} exited with code ${code}: ${errdata}`)
			}

			resolve(data)
		})
	})
}

async function gitFetch() {
	return await exec('git', ['fetch', '--depth=10000'])
}

async function gitHeadHash() {
	const data = await exec('git', ['rev-parse', '--short', 'HEAD'])
	return data.trim()
}

function getRelease() {
	const package = require(__dirname + '/../package.json')
	return package.version
}

async function getCount() {
	let data = await exec('git', ['log'])
	data = data.split(/\r?\n/)
	return data.filter((line) => line.match(/^commit/)).length
}

async function run() {
	let build
	let release
	let head
	let count

	try {
		await gitFetch()
		head = await gitHeadHash()
		release = getRelease()
		count = await getCount()

		build = `${release}-${head}-${count}`
		fs.writeFileSync(__dirname + '/../BUILD', build)
	} catch (e) {
		console.error('Error generating data for BUILD file', e)
		process.exit(1)
	}

	console.log(`RELEASE ${release}`)
	console.log(`PARSE_GIT_HASH ${head}`)

	let list
	try {
		list = fs.readdirSync(__dirname + '/../electron-output')
		list = list.map((line) => 'electron-output/' + line)
		console.log(list.join('\n'))
	} catch (e) {
		console.error('Error opening electron-output directory', e)
		process.exit(1)
	}

	let artifact_source
	let artifact_dest

	if (process.env.TRAVIS_OS_NAME === 'osx') {
		artifact_source = list.find((file) => file.match(/\.dmg$/))
		artifact_dest = `companion-${build}-mac.dmg`
		console.log('OSX')
	} else if (process.env.TRAVIS_OS_NAME === 'linux') {
		artifact_source = list.find((file) => file.match(/\.gz$/))
		artifact_dest = `companion-${build}-linux.tar.gz`
		console.log('LINUX')
	} else if (process.env.TRAVIS_OS_NAME === 'win64') {
		artifact_source = list.find((file) => file.match(/\.exe$/))
		artifact_dest = `companion-${build}-win64.exe`
		console.log('WINDOWS')
	} else if (process.env.TRAVIS_OS_NAME === 'armv7l') {
		artifact_source = list.find((file) => file.match(/\.z$/))
		artifact_dest = `companion-${build}-armv7l.tar.gz`
		console.log('ARM')
	} else {
		console.error(`Unknown operating system: ${process.env.TRAVIS_OS_NAME}`)
		process.exit(1)
	}

	console.log('UPLOADING')
	try {
		console.log('Upload ', artifact_source, ' to ', artifact_dest)
		await exec('node', ['./tools/upload_build.js', artifact_source, artifact_dest])
	} catch (e) {
		console.error('Error uploading artifact: ', e)
		process.exit(1)
	}

	console.log('DONE')
}

run()
