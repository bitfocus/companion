#!/usr/bin/env zx

import { Octokit, App } from 'octokit'
import { confirm } from '@inquirer/prompts'
import open from 'open'
import dotenv from 'dotenv'
dotenv.config()

$.verbose = false

if (argv._.length < 1) {
	console.log('Usage: yarn tsx tools/backport_module_changes.mjs stable-3.x')
	process.exit(1)
}

const oldRev = argv._[0]

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

const {
	data: { login },
} = await octokit.rest.users.getAuthenticated()
console.log('Hello, %s', login)

const newList = await octokit.rest.repos.getContent({
	owner: 'bitfocus',
	repo: 'companion-bundled-modules',
	path: '',
	ref: 'main',
})

const versionMatch = /GIT_REF=(\S+)/

async function getVersion(rev, path) {
	try {
		const req = await fetch(
			`https://raw.githubusercontent.com/bitfocus/companion-bundled-modules/${rev}/${path}/.build-info`
		)
		const text = await req.text()

		const match = versionMatch.exec(text)

		if (match) return match[1]
		return null
	} catch (e) {
		return null
	}
}

for (const item of newList.data) {
	if (item.path === '.github') continue

	if (item.type === 'dir') {
		const [oldRef, newRef] = await Promise.all([getVersion(oldRev, item.path), getVersion('main', item.path)])

		// console.log(oldRef, newRef)

		if (!oldRef || !newRef) {
			console.log(`Ignoring ${item.path} (${oldRef} -> ${newRef})`)
			continue
		}

		if (oldRef !== newRef) {
			// changedDirs.push(item.path)
			console.log(`>>> change in ${item.path} (${oldRef} -> ${newRef})`)

			const compareUrl = `https://github.com/bitfocus/companion-module-${item.path}/compare/${oldRef}...${newRef}`
			await open(compareUrl)

			const action = await confirm({
				// name: 'action',
				message: 'Merge it? ',
				default: false,
			})
			if (action) {
				console.log(`importing ${item.path}@${newRef} into ${oldRev}`)

				await octokit.rest.actions.createWorkflowDispatch({
					owner: 'bitfocus',
					repo: 'companion-bundled-modules',
					workflow_id: 'update-module.yml',
					ref: oldRev,
					inputs: {
						'module-name': item.path,
						'git-ref': newRef,
					},
				})
			}
		}
	}
}
