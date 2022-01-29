/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

const { sendResult } = require('../Resources/Util')

exports = module.exports = function (system) {
	return new GraphicsPreview(system)
}

class GraphicsPreview {
	debug = require('debug')('lib/Graphics/Preview')

	constructor(system) {
		this.system = system
		this.pages = {}
		this.previews = {}

		this.system.emit('graphics_get', (_graphics) => {
			this.graphics = _graphics
		})

		this.system.emit('io_get', (io) => {
			this.system.on('io_connect', (socket) => {
				this.debug('socket ' + socket.id + ' connected')

				// Install preview image handler
				socket._previewHandler = this.handlePreview.bind(this, socket)
				socket.on('bank_preview', socket._previewHandler)

				socket._schedulerHandler = this.handleSchedule.bind(this, socket)
				socket.on('scheduler_bank_preview', socket._schedulerHandler)
				socket._schedulerPreview = []

				this.previews[socket.id] = socket

				socket._previewPageHandler = this.handlePreviewPage.bind(this, socket)
				socket.on('bank_preview_page', socket._previewPageHandler)

				socket._webButtonsHandler = this.handleWebButtons.bind(this, socket)
				socket.on('web_buttons', socket._webButtonsHandler)

				socket._webButtonsPageHandler = this.handleWebButtonsPage.bind(this, socket)
				socket.on('web_buttons_page', socket._webButtonsPageHandler)

				socket.on('disconnect', () => {
					socket.removeListener('bank_preview', socket._previewHandler)
					socket.removeListener('bank_preview_page', socket._previewPageHandler)
					socket.removeListener('web_buttons', socket._webButtonsHandler)
					socket.removeListener('web_buttons_page', socket._webButtonsPageHandler)

					delete socket._previewHandler
					delete socket._schedulerHandler
					delete socket.web_buttons
					delete this.previews[socket.id]
					this.debug('socket ' + socket.id + ' disconnected')
				})
			})

			this.system.emit('get_page', (_pages) => {
				this.pages = _pages
			})

			this.system.on('bank_style_changed', (page, bank) => {
				this.updateWebButtonsPage(page)
			})
			this.system.on('page_update', (page) => {
				this.updateWebButtonsPage(page)
			})
		})

		this.system.on('graphics_bank_invalidated', this.updateBank.bind(this))
	}

	updateWebButtonsPage(page) {
		const newInfo = this.getExtendedPageInfo(page)

		for (const key in this.previews) {
			let socket = this.previews[key]
			if (socket.web_buttons) {
				socket.emit('page_update_ext', page, newInfo)
			}
		}
	}

	handleSchedule(socket, page, bank, stop_watching) {
		socket._schedulerPreview = socket._schedulerPreview.filter((i) => i.page !== page || i.bank !== bank)
		if (!stop_watching) {
			socket._schedulerPreview.push({
				page: page,
				bank: bank,
			})

			let img = this.graphics.getBank(page, bank)
			socket.emit('schedule_preview_data', page, bank, img.buffer, img.updated)
		}
	}

	handlePreview(socket, page, bank) {
		this.debug('handlePreview()', page, bank)

		if (page === false) {
			this.debug('socket ' + socket.id + ' removed preview listener')
			socket._preview = undefined
			return
		}
		this.debug('socket ' + socket.id + ' added preview listener for ' + page + ', ' + bank)

		socket._preview = { page: page, bank: bank }

		let img = this.graphics.getBank(page, bank)
		socket.emit('preview_bank_data', page, bank, img.buffer, img.updated)
	}

	handleWebButtons(socket, answer) {
		this.debug('handleWebButtons()')

		const pages = {}
		for (const id in this.pages) {
			pages[id] = this.getExtendedPageInfo(id)
		}

		socket.web_buttons = 1
		sendResult(socket, answer, 'pages', pages)
	}

	getExtendedPageInfo(index) {
		const newPage = {
			...this.pages[index],
			pagenum: [],
			pageup: [],
			pagedown: [],
		}

		this.system.emit('get_banks_for_page', index, (pageBanks) => {
			for (const bank in pageBanks) {
				const info = pageBanks[bank]
				if (info) {
					switch (info.style) {
						case 'pageup':
							newPage.pageup.push(bank)
							break
						case 'pagenum':
							newPage.pagenum.push(bank)
							break
						case 'pagedown':
							newPage.pagedown.push(bank)
							break
					}
				}
			}
		})

		return newPage
	}

	handleWebButtonsPage(socket, page, cache, answer) {
		this.debug('handleWebButtonsPage()', page)

		let result = {}

		if (cache === null) return

		let images = this.graphics.getImagesForPage(page)
		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			if (cache === undefined || cache[parseInt(i) + 1] === undefined || cache[parseInt(i) + 1] != images[i].updated) {
				result[parseInt(i) + 1] = images[i]
			}
		}

		sendResult(socket, answer, 'buttons_page_data', page, result)
	}

	handlePreviewPage(socket, page, cache) {
		let result = {}

		socket._previewPage = page

		let images = this.graphics.getImagesForPage(page)

		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			if (cache === undefined || cache[parseInt(i) + 1] === undefined || cache[parseInt(i) + 1] != images[i].updated) {
				result[parseInt(i) + 1] = images[i]
			}
		}

		socket.emit('preview_page_data', result)
	}

	updateBank(page, bank) {
		for (const key in this.previews) {
			let socket = this.previews[key]

			if (socket._preview !== undefined) {
				if (socket._preview.page == page && socket._preview.bank == bank) {
					let img = this.graphics.getBank(socket._preview.page, socket._preview.bank)
					socket.emit('preview_bank_data', page, bank, img.buffer, img.updated)
				}
			}

			if (socket._schedulerPreview.find((i) => i.bank == bank && i.page == page) !== undefined) {
				let img = this.graphics.getBank(page, bank)
				socket.emit('schedule_preview_data', page, bank, img.buffer, img.updated)
			}

			if (socket.web_buttons) {
				let result = {}
				let img = this.graphics.getBank(page, bank)
				result[bank] = img

				socket.emit('buttons_bank_data', page, result)
			} else if (socket._previewPage !== undefined) {
				if (socket._previewPage == page) {
					let result = {}
					let img = this.graphics.getBank(page, bank)
					result[bank] = img

					socket.emit('preview_page_data', result)
				}
			}
		}
	}
}
