#!/usr/bin/env zx

import fs from 'fs-extra'
import dotenv from 'dotenv'
dotenv.config()

const GH_TOKEN = process.env.GITHUB_TOKEN

async function doModule(modName) {
	const res = await fetch(`https://api.github.com/repos/bitfocus/${modName}/commits?per_page=100`, {
		headers: {
			Authorization: `Bearer ${GH_TOKEN}`,
		},
	})

	const data = await res.json()

	let str = null

	for (const commit of data) {
		try {
			if (
				commit.author?.login !== 'Julusian' &&
				commit.author?.login !== 'companion-module-bot' &&
				commit.author?.login !== 'dependabot[bot]'
			) {
				const date = new Date(commit.commit.author.date)
				console.log(date, date.getFullYear(), date.getMonth(), date.getDate())
				// console.log(commit.commit.author.date, date, commit.author.login)

				str = `${modName},${commit.author?.login ?? ''},${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`

				break
			}
		} catch (e) {
			console.error(e, commit)
		}
	}

	if (!str) {
		str = `${modName},,`
	}

	try {
		const issues = await fetch(`https://api.github.com/graphql`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${GH_TOKEN}`,
				'Content-type': 'application/json',
			},
			body: JSON.stringify({
				query: `query { 
  repository(owner:"bitfocus", name:"${modName}") { 
    open: issues(states:OPEN) {
      totalCount
    }
    closed: issues(states:CLOSED) {
      totalCount
    }
    total: issues {
      totalCount
    }
  }
}`,
			}),
		})

		const data2 = await issues.json()

		console.log(data2)
		str += `,${data2.data.repository.total.totalCount},${data2.data.repository.open.totalCount},${data2.data.repository.closed.totalCount}`
	} catch (e) {
		console.error('issues', e)
	}

	console.log(str)
	res2.push(str)
}

const pkgJsonStr = await fs.readFile('./module-legacy/package.json')
const pkgJson = JSON.parse(pkgJsonStr.toString())

const res2 = []
try {
	const mods = await fs.readdir('./bundled-modules')
	for (const name of mods) {
		if (!name.startsWith('.') && (await fs.stat(path.join('./bundled-modules', name))).isDirectory()) {
			await doModule('companion-module-' + name)
		}
	}

	for (const [name, version] of Object.entries(pkgJson.dependencies)) {
		if (name.startsWith('companion-module-')) {
			await doModule(name)
		}
	}
} catch (e) {
	//
	console.error(e)
}

console.log(res2.join('\n'))
