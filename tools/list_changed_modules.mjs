#!/usr/bin/env zx

import { Octokit, App } from 'octokit'
import dotenv from 'dotenv'
dotenv.config()

$.verbose = false

if (argv._.length < 3) {
	console.log('Needs two refs to compare')
	process.exit(1)
}

const oldRev = argv._[1]
const newRev = argv._[2]

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

const {
	data: { login },
} = await octokit.rest.users.getAuthenticated()
console.log('Hello, %s', login)

const newList = await octokit.rest.repos.getContent({
	owner: 'bitfocus',
	repo: 'companion-bundled-modules',
	path: '',
	ref: newRev,
})

const changedDirs = []
for (const item of newList.data) {
	if (item.path === '.github') continue

	if (item.type === 'dir') {
		const [oldInfo, newInfo] = await Promise.all([
			octokit.rest.repos.listCommits({
				owner: 'bitfocus',
				repo: 'companion-bundled-modules',
				path: item.path,
				per_page: 1,
				page: 1,
				sha: oldRev,
			}),
			//
			octokit.rest.repos.listCommits({
				owner: 'bitfocus',
				repo: 'companion-bundled-modules',
				path: item.path,
				per_page: 1,
				page: 1,
				sha: newRev,
			}),
		])

		const oldSha = oldInfo.data[0]?.commit?.tree?.sha
		const newSha = newInfo.data[0]?.commit?.tree?.sha
		console.log(item.path, oldSha, newSha)

		if (oldSha !== newSha) {
			changedDirs.push(item.path)
		}
	}
}

changedDirs.sort()

console.log('=================')
console.log('changed modules')
console.log(changedDirs.join('\n'))
