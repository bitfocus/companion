#!/usr/bin/env zx

import { Octokit, App } from 'octokit'
import dotenv from 'dotenv'
dotenv.config()

$.verbose = false

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

const {
	data: { login },
} = await octokit.rest.users.getAuthenticated()
console.log('Hello, %s', login)

const prs = await octokit.rest.search.issuesAndPullRequests({
	q: 'is:pr is:open archived:false sort:updated-desc user:bitfocus author:app/dependabot',
	per_page: 100,
})

// console.log('issues', prs)
for (const pr of prs.data.items) {
	try {
		const parts = pr.repository_url.split('/')
		const name = parts[parts.length - 1]
		if (
			pr.user.login === 'dependabot[bot]' &&
			pr.title.toLocaleLowerCase().includes('bump webpack') &&
			name.startsWith('companion-module-')
		) {
			console.log(`Merging PR '${pr.title}' from ${name} (${pr.html_url}) `)
			await octokit.rest.pulls.merge({
				owner: 'bitfocus',
				repo: name,
				pull_number: pr.number,
			})
		}
	} catch (e) {
		console.log(`${pr.html_url} Merge failed: ${e}`)
		// console.log(pr)
	}
}
