import { themes as prismThemes } from 'prism-react-renderer'
import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'
import lunrPlugin from 'docusaurus-lunr-search'

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
	title: 'Bitfocus Companion',
	tagline: 'User documentation',
	favicon: 'img/favicon.ico',

	// Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
	future: {
		v4: true, // Improve compatibility with the upcoming Docusaurus v4
	},

	// Set the production url of your site here
	url: 'https://your-docusaurus-site.example.com',
	// Set the /<baseUrl>/ pathname under which your site is served
	// For GitHub pages deployment, it is often '/<projectName>/'
	baseUrl: `${process.env.BASE_URL ?? ''}/user-guide`,

	organizationName: 'bitfocus', // Usually your GitHub org/user name.
	projectName: 'companion', // Usually your repo name.

	onBrokenLinks: 'throw',
	onBrokenAnchors: 'throw',

	// Even if you don't use internationalization, you can use this field to set
	// useful metadata like html lang. For example, if your site is Chinese, you
	// may want to replace "en" with "zh-Hans".
	i18n: {
		defaultLocale: 'en',
		locales: ['en'],
	},

	presets: [
		[
			'classic',
			{
				docs: {
					path: './user-guide',
					routeBasePath: '/',
					sidebarPath: './sidebars.ts',
					editUrl: 'https://github.com/bitfocus/companion/tree/main/docs/',
				},
				theme: {
					customCss: './src/css/custom.css',
				},
			} satisfies Preset.Options,
		],
	],

	themeConfig: {
		// Replace with your project's social card
		// image: 'img/docusaurus-social-card.jpg',
		colorMode: {
			respectPrefersColorScheme: true,
		},
		navbar: {
			title: 'Bitfocus Companion - Documentation',
			logo: {
				alt: 'Logo',
				src: 'img/logo.png',
			},
			items: [
				{
					title: 'Download Companion',
					href: 'https://bfoc.us/djzdpq4g9g',
					'aria-label': 'Download Companion',
					className: 'fontawesome-container',
					html: `<svg class="fontawesome" viewBox="0 0 640 640" fill="currentColor" aria-label="Download Companion" xmlns="http://www.w3.org/2000/svg">
							<!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.-->
							<path d="M176 544C96.5 544 32 479.5 32 400C32 336.6 73 282.8 129.9 263.5C128.6 255.8 128 248 128 240C128 160.5 192.5 96 272 96C327.4 96 375.5 127.3 399.6 173.1C413.8 164.8 430.4 160 448 160C501 160 544 203 544 256C544 271.7 540.2 286.6 533.5 299.7C577.5 320 608 364.4 608 416C608 486.7 550.7 544 480 544L176 544zM409 377C418.4 367.6 418.4 352.4 409 343.1C399.6 333.8 384.4 333.7 375.1 343.1L344.1 374.1L344.1 272C344.1 258.7 333.4 248 320.1 248C306.8 248 296.1 258.7 296.1 272L296.1 374.1L265.1 343.1C255.7 333.7 240.5 333.7 231.2 343.1C221.9 352.5 221.8 367.7 231.2 377L303.2 449C312.6 458.4 327.8 458.4 337.1 449L409.1 377z"/>
							</svg>
							<span class="fontawesome-text">Download Companion</span>`,
					position: 'right',
				},
				{
					title: 'Companion Website',
					href: 'https://bitfocus.io/companion',
					'aria-label': 'Companion Website',
					className: 'fontawesome-container', // make it format like the other icons. (classes set here and in the html property)
					html: `<img src="${process.env.BASE_URL ?? ''}/user-guide/img/logo-no-black.png" class="fontawesome" alt="Companion Website" /><span class="fontawesome-text">Companion Website</span>`,
					position: 'right',
				},
				{
					type: 'dropdown',
					label: 'Support',
					position: 'right',
					items: [
						{
							title: 'Share your experience or ask questions to your Companions.',
							href: 'https://bfoc.us/qjk0reeqmy',
							'aria-label': 'Companion Facebook Group',
							className: 'fontawesome-container',
							html: `<svg class="fontawesome" viewBox="0 0 640 640" fill="currentColor" aria-label="Companion Facebook Group" xmlns="http://www.w3.org/2000/svg">
									<!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.-->
									<path d="M576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 440 146.7 540.8 258.2 568.5L258.2 398.2L205.4 398.2L205.4 320L258.2 320L258.2 286.3C258.2 199.2 297.6 158.8 383.2 158.8C399.4 158.8 427.4 162 438.9 165.2L438.9 236C432.9 235.4 422.4 235 409.3 235C367.3 235 351.1 250.9 351.1 292.2L351.1 320L434.7 320L420.3 398.2L351 398.2L351 574.1C477.8 558.8 576 450.9 576 320z"/>
									</svg>
									<span class="fontawesome-text">Companion Facebook Group</span>`,
						},
						{
							title: 'Discuss technical issues on Slack.',
							href: 'https://bfoc.us/ke7e9dqgaz',
							'aria-label': 'Companion Slack Group',
							className: 'fontawesome-container',
							html: `<svg class="fontawesome" viewBox="0 0 640 640" fill="currentColor" aria-label="Companion Slack Group" xmlns="http://www.w3.org/2000/svg">
										<!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.-->
										<path d="M190.1 379.1C190.1 405 168.9 426.2 143 426.2C117.1 426.2 96 405 96 379.1C96 353.2 117.2 332 143.1 332L190.2 332L190.2 379.1zM213.8 379.1C213.8 353.2 235 332 260.9 332C286.8 332 308 353.2 308 379.1L308 496.9C308 522.8 286.8 544 260.9 544C235 544 213.8 522.8 213.8 496.9L213.8 379.1zM260.9 190.1C235 190.1 213.8 168.9 213.8 143C213.8 117.1 235 96 260.9 96C286.8 96 308 117.2 308 143.1L308 190.2L260.9 190.2zM260.9 213.8C286.8 213.8 308 235 308 260.9C308 286.8 286.8 308 260.9 308L143.1 308C117.2 308 96 286.8 96 260.9C96 235 117.2 213.8 143.1 213.8L260.9 213.8zM449.9 260.9C449.9 235 471.1 213.8 497 213.8C522.9 213.8 544 235 544 260.9C544 286.8 522.8 308 496.9 308L449.8 308L449.8 260.9zM426.2 260.9C426.2 286.8 405 308 379.1 308C353.2 308 332 286.8 332 260.9L332 143.1C332 117.2 353.2 96 379.1 96C405 96 426.2 117.2 426.2 143.1L426.2 260.9zM379.1 449.9C405 449.9 426.2 471.1 426.2 497C426.2 522.9 405 544 379.1 544C353.2 544 332 522.8 332 496.9L332 449.8L379.1 449.8zM379.1 426.2C353.2 426.2 332 405 332 379.1C332 353.2 353.2 332 379.1 332L496.9 332C522.8 332 544 353.2 544 379.1C544 405 522.8 426.2 496.9 426.2L379.1 426.2z"/>
										</svg>
										<span class="fontawesome-text">Companion Slack Group</span>`,
						},
						{
							title: 'Report bugs, request features or contribute code on GitHub.',
							href: 'https://bfoc.us/4orxauukeg',
							'aria-label': 'Companion GitHub Repo',
							className: 'fontawesome-container',
							html: `<svg class="fontawesome" viewBox="0 0 640 640" fill="currentColor" aria-label="Companion GitHub Repo" xmlns="http://www.w3.org/2000/svg">
									<!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.-->
									<path d="M237.9 461.4C237.9 463.4 235.6 465 232.7 465C229.4 465.3 227.1 463.7 227.1 461.4C227.1 459.4 229.4 457.8 232.3 457.8C235.3 457.5 237.9 459.1 237.9 461.4zM206.8 456.9C206.1 458.9 208.1 461.2 211.1 461.8C213.7 462.8 216.7 461.8 217.3 459.8C217.9 457.8 216 455.5 213 454.6C210.4 453.9 207.5 454.9 206.8 456.9zM251 455.2C248.1 455.9 246.1 457.8 246.4 460.1C246.7 462.1 249.3 463.4 252.3 462.7C255.2 462 257.2 460.1 256.9 458.1C256.6 456.2 253.9 454.9 251 455.2zM316.8 72C178.1 72 72 177.3 72 316C72 426.9 141.8 521.8 241.5 555.2C254.3 557.5 258.8 549.6 258.8 543.1C258.8 536.9 258.5 502.7 258.5 481.7C258.5 481.7 188.5 496.7 173.8 451.9C173.8 451.9 162.4 422.8 146 415.3C146 415.3 123.1 399.6 147.6 399.9C147.6 399.9 172.5 401.9 186.2 425.7C208.1 464.3 244.8 453.2 259.1 446.6C261.4 430.6 267.9 419.5 275.1 412.9C219.2 406.7 162.8 398.6 162.8 302.4C162.8 274.9 170.4 261.1 186.4 243.5C183.8 237 175.3 210.2 189 175.6C209.9 169.1 258 202.6 258 202.6C278 197 299.5 194.1 320.8 194.1C342.1 194.1 363.6 197 383.6 202.6C383.6 202.6 431.7 169 452.6 175.6C466.3 210.3 457.8 237 455.2 243.5C471.2 261.2 481 275 481 302.4C481 398.9 422.1 406.6 366.2 412.9C375.4 420.8 383.2 435.8 383.2 459.3C383.2 493 382.9 534.7 382.9 542.9C382.9 549.4 387.5 557.3 400.2 555C500.2 521.8 568 426.9 568 316C568 177.3 455.5 72 316.8 72zM169.2 416.9C167.9 417.9 168.2 420.2 169.9 422.1C171.5 423.7 173.8 424.4 175.1 423.1C176.4 422.1 176.1 419.8 174.4 417.9C172.8 416.3 170.5 415.6 169.2 416.9zM158.4 408.8C157.7 410.1 158.7 411.7 160.7 412.7C162.3 413.7 164.3 413.4 165 412C165.7 410.7 164.7 409.1 162.7 408.1C160.7 407.5 159.1 407.8 158.4 408.8zM190.8 444.4C189.2 445.7 189.8 448.7 192.1 450.6C194.4 452.9 197.3 453.2 198.6 451.6C199.9 450.3 199.3 447.3 197.3 445.4C195.1 443.1 192.1 442.8 190.8 444.4zM179.4 429.7C177.8 430.7 177.8 433.3 179.4 435.6C181 437.9 183.7 438.9 185 437.9C186.6 436.6 186.6 434 185 431.7C183.6 429.4 181 428.4 179.4 429.7z"/>
									</svg>
									<span class="fontawesome-text">Companion GitHub</span>`,
						},
						{
							type: 'html',
							value: '<hr style="margin: 0.5em;"/>',
						},
						{
							title: 'Help fund Bitfocus Companion.',
							href: 'https://bfoc.us/ccfbf8wm2x',
							'aria-label': 'Sponsor Companion',
							className: 'fontawesome-container',
							html: `<svg class="fontawesome" viewBox="0 0 640 640" fill="currentColor" aria-label="Sponsor Companion" xmlns="http://www.w3.org/2000/svg">
									<!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.-->
									<path d="M296 88C296 74.7 306.7 64 320 64C333.3 64 344 74.7 344 88L344 128L400 128C417.7 128 432 142.3 432 160C432 177.7 417.7 192 400 192L285.1 192C260.2 192 240 212.2 240 237.1C240 259.6 256.5 278.6 278.7 281.8L370.3 294.9C424.1 302.6 464 348.6 464 402.9C464 463.2 415.1 512 354.9 512L344 512L344 552C344 565.3 333.3 576 320 576C306.7 576 296 565.3 296 552L296 512L224 512C206.3 512 192 497.7 192 480C192 462.3 206.3 448 224 448L354.9 448C379.8 448 400 427.8 400 402.9C400 380.4 383.5 361.4 361.3 358.2L269.7 345.1C215.9 337.5 176 291.4 176 237.1C176 176.9 224.9 128 285.1 128L296 128L296 88z"/>
									</svg>
									<span class="fontawesome-text">Sponsor Companion</span>`,
						},
					],
				},
			],
		},
		// footer: {
		// 	style: 'dark',
		// 	links: [
		// 		{
		// 			title: 'Docs',
		// 			items: [
		// 				{
		// 					label: 'Tutorial',
		// 					to: '/docs/intro',
		// 				},
		// 			],
		// 		},
		// 		{
		// 			title: 'Community',
		// 			items: [
		// 				{
		// 					label: 'Stack Overflow',
		// 					href: 'https://stackoverflow.com/questions/tagged/docusaurus',
		// 				},
		// 				{
		// 					label: 'Discord',
		// 					href: 'https://discordapp.com/invite/docusaurus',
		// 				},
		// 				{
		// 					label: 'X',
		// 					href: 'https://x.com/docusaurus',
		// 				},
		// 			],
		// 		},
		// 		{
		// 			title: 'More',
		// 			items: [
		// 				// {
		// 				// 	label: 'Blog',
		// 				// 	to: '/blog',
		// 				// },
		// 				{
		// 					label: 'GitHub',
		// 					href: 'https://github.com/facebook/docusaurus',
		// 				},
		// 			],
		// 		},
		// 	],
		// 	copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
		// },
		prism: {
			theme: prismThemes.github,
			darkTheme: prismThemes.dracula,
		},
	} satisfies Preset.ThemeConfig,

	plugins: [lunrPlugin],
}

export default config
