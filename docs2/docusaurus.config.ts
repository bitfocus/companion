import { themes as prismThemes } from 'prism-react-renderer'
import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
	title: 'Bitfocus Comppanion',
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
	baseUrl: '/docs',

	organizationName: 'bitfocus', // Usually your GitHub org/user name.
	projectName: 'companion', // Usually your repo name.

	onBrokenLinks: 'throw',

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
			title: 'My Site',
			logo: {
				alt: 'My Site Logo',
				src: 'img/logo.svg',
			},
			items: [
				{
					type: 'docSidebar',
					sidebarId: 'tutorialSidebar',
					position: 'left',
					label: 'Tutorial',
				},
				{
					href: 'https://github.com/facebook/docusaurus',
					label: 'GitHub',
					position: 'right',
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
}

export default config
