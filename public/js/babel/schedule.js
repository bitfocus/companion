class schedule_frontend {
	/**
	 * @param {SocketIOClientStatic} socket
	 */
	constructor(socket) {
		this.dateFormat = 'MM/DD HH:mm:ss';
		this.socket = socket;
		this.editorSetup = false;
		this.previewCache = {};
		this.eventList = [];

		this.elements = {
			list: $('#schedulerEventList'),
			new: $('#scheduleEditorNew'),
			modal: $('#scheduleModal'),
			config: $('#scheduleConfigurable'),
			type: $('#scheduleEditorType'),
			form: $('#scheduleModal').find('form')
		};
		this.form = null;

		this.elements.new.on('click', this.editEvent.bind(this, null));
		this.elements.form.on('submit', this.saveForm.bind(this));
		this.socket.emit('schedule_plugins', this.loadPlugins.bind(this));
		this.socket.on('schedule_preview_data', this.previewUpdate.bind(this));
	}

	/**
	 * Loads enabled plugins and begins watching for schedule events
	 * @param {Object[]} plugins
	 */
	loadPlugins(plugins) {
		this.plugins = plugins;

		// Can't use these until plugins are loaded...
		this.socket.emit('schedule_get', this.loadSchedule.bind(this));
		this.socket.on('schedule_refresh', this.loadSchedule.bind(this));
	}

	/**
	 * @access protected
	 */
	inputText(field, id = 0) {
		const item = $(`<input type="text" name="${field.key}" class="form-control" placeholder="${field.placeholder || ''}">`);

		if (!field.notRequired) {
			item.attr('required', true);
		}

		if (field.pattern) {
			item.attr('pattern', field.pattern);
		}

		return item;
	}

	/**
	 * @access protected
	 */
	inputSelect(field, select2 = true) {
		const item = $(`<select name="${field.key}" class="${select2 ? 'select2 ' : ''}form-control" style="width: 100%"></select>`);

		if (field.multi) {
			item.attr('multiple', true);
		}

		if (!field.notRequired) {
			item.attr('required', true);
		}

		field.choices.forEach(c => {
			item.append(`<option value="${c.id}">${c.label}</option>`);
		});

		return item;
	}

	multipleRow(plugin, showDelete = false, tableElm = null) {
		if (!tableElm) {
			tableElm = $(`#scheduleEditor${plugin.type} tbody`);
		}
		let row = $('<tr></tr>');
		plugin.options.forEach(f => {
			let id = 'scheduleEditor' + plugin.type + f.key;
			let item;
			if (f.type === 'textinput') {
				item = this.inputText(f);
			} else if (f.type === 'select') {
				item = this.inputSelect(f, false);
			} else {
				return;
			}
			row.append($('<td></td>').append(item));
		});

		if (showDelete) {
			row.append($('<td></td>').append('<a href="#"><i class="fa fa-times"></i></a>').on('click', this.multipleDel.bind(this, row)));
		}

		tableElm.append(row);
	}

	multipleTable(p) {
		let table = $(`<table></table>`);
		let tr = $('<tr></tr>');
		p.options.forEach(f => {
			tr.append(`<th>${f.name}</th>`);
		});
		table.append(tr);
		let tbody = $('<tbody></tbody>');
		table.append(tbody);
		this.multipleRow(p, false, tbody);

		return table;
	}

	multipleDel(row) {
		row.remove();
	}

	/**
	 * @access protected
	 */
	editorReset() {
		this.elements.form.trigger('reset');
		// Remove any additional conditions that may have been set
		$(`.scheduleConfig tbody tr:nth-child(1n+2)`).remove();
	}

	/**
	 * Loads the editor modal
	 * @access protected
	 */
	setupEditor() {
		if (this.editorSetup) {
			return this.editorReset();
		}

		this.plugins.forEach(p => {
			const type = p.type;
			let fields = $(`<div id="scheduleEditor${type}" class="scheduleConfig"></div>`);

			// Multis are done in a table setup
			if (p.multiple) {
				let table = this.multipleTable(p);
				fields.append(table);
				fields.append($('<a href="#">Add Additional Condition</a>').on('click', this.multipleRow.bind(this, p, true, null)));
			} else {
				p.options.forEach(f => {
					let item = $(`<div class="form-group">
						<label>${f.name}</label>
					</div>`);
					if (f.type === 'textinput') {
						item.append(this.inputText(f));
					} else if (f.type === 'select') {
						item.append(this.inputSelect(f));
					}
					fields.append(item);
				});
			}
			this.elements.type.append(`<option value="${type}">${p.name}</option>`);
			this.elements.config.append(fields);
		});

		this.editorSetup = true;
	}

	/**
	 * Change plugin type and enable properties for editing
	 * @param {string} type
	 */
	changeType(type) {
		const elmId = '#scheduleEditor' + type;
		$(`.scheduleConfig:not(${elmId})`).hide()
			.find('input, select')
			.attr('disabled', true);
		$(elmId).show()
			.find('input, select')
			.attr('disabled', false);
	}

	/**
	 * Edit event
	 * @param {number} eventId
	 */
	editEvent(eventId = null) {
		this.setupEditor();
		this.elements.form.trigger('reset');

		if (eventId !== null) {
			this.loadForm(eventId);
		}
		this.editId = eventId;

		this.elements.modal.modal('show');

		this.elements.form.find('.select2').select2();
		this.elements.type.on('change', x => this.changeType(x.target.value))
			.trigger('change');
	}

	/**
	 * Load with configuration
	 * @param {number} eventId
	 */
	loadForm(eventId) {
		let initConfig = this.getEvent(eventId);

		// Load title, button, type
		this.configLoad(initConfig);

		if (Array.isArray(initConfig.config)) {
			let pt = this.getPluginType(initConfig.type);
			initConfig.config.forEach((c, i) => {
				if (i > 0) {
					this.multipleRow(pt, true);
				}
				this.configLoad(c, i)
			});
		} else {
			this.configLoad(initConfig.config);
		}
	}

	/**
	 * Loads one row of configs
	 * @access protected
	 */
	configLoad(configVals, num = 0) {
		for (const name in configVals) {
			const elm = this.elements.form.find(`[name="${name}"]:nth(${num})`);
			if (elm.length) {
				elm.val(configVals[name]);
			}
		}
	}

	/**
	 * Save form
	 * @param {Event} evt
	 */
	saveForm(evt) {
		evt.preventDefault();

		this.form = new FormData(this.elements.form[0]);
		let sendData = {
			id: this.editId,
			title: this.form.get('title'),
			type: this.form.get('type'),
			button: this.form.get('button'),
			config: this.pluginSave()
		};

		this.socket.emit('schedule_save_item', sendData, clean => {
			if (this.editId !== null) {
				let initConfig = this.getEvent(this.editId);
				if (clean.button != initConfig.button && $(`canvas[data-schedule-bank="${initConfig.button}"]`).length === 1) {
					this.previewUpdateStop(initConfig.button);
				}
			}

			if (this.eventList.length === 0) {
				this.loadSchedule([clean]);
			} else {
				this.updateCache(clean.id, clean);
				this.eventIteam(clean, clean.id);
			}

			this.elements.modal.modal('hide');
		});
	}

	/**
	 * Watch for previews
	 * @param {String} button
	 */
	previewWatch(button) {
		let [page, bank] = button.split('.');
		if (button in this.previewCache) {
			if (this.previewCache[button] !== null) { // May not have received the response yet
				this.previewUpdate(page, bank, this.previewCache[button]);
			}
		} else {
			this.previewCache[button] = null;
			this.socket.emit('scheduler_bank_preview', page, bank);
		}
	}

	/**
	 * Updates the preview image for the button number
	 * @param {String} page
	 * @param {String} bank
	 * @param {ArrayBuffer} img
	 */
	previewUpdate(page, bank, img) {
		this.previewCache[`${page}.${bank}`] = img;

		let canvas = $(`canvas[data-schedule-bank="${page}.${bank}"]`);
		canvas.each((t, c) => {
			c.getContext('2d')
				 .putImageData(dataToButtonImage(img), 0, 0);
		});
	}

	/**
	 * Stop watching for previews
	 * @param {String} button
	 */
	previewUpdateStop(button) {
		let [page, bank] = button.split('.');
		this.socket.emit('scheduler_bank_preview', page, bank, true);
		delete this.previewCache[button];
	}

	/**
	 * Get the plugin of the type given
	 * @param {string} type
	 * @return {Object}
	 */
	getPluginType(type) {
		return this.plugins.find(p => p.type === type);
	}

	/**
	 * Get configuration from form that plugin accepts to save
	 * @return {Object}
	 */
	pluginSave() {
		let type = this.form.get('type');
		let config = [];
		const plugin = this.getPluginType(type);

		let formElms = $(`#scheduleEditor${type}`);
		if (plugin.multiple) {
			formElms = formElms.find('tbody tr');
		}

		formElms.each((t, f) => {
			const condition = {};
			plugin.options.forEach(x => {
				condition[x.key] = this.getCondition(f, x);
			});

			config.push(condition);
		});

		return config;
	}

	/**
	 * @access protected
	 */
	getCondition(form, confKey) {
		let value;
		const formVar = $(form).find(`[name="${confKey.key}"]`);

		if (confKey.multi) {
			try {
				value = formVar.val()
					.filter(x => x !== null);
			} catch (e) {
				value = [];
			}
		} else {
			value = formVar.val();
		}

		return value;
	}

	/**
	 * Load event schedule list
	 * @param {Object[]} scheduleList Array of schedules received from the server
	 */
	loadSchedule(scheduleList) {
		this.eventList = scheduleList;

		if (this.eventList.length) {
			this.elements.list.html('');
			this.eventList.forEach(i => this.eventIteam(i, null));
		} else {
			this.emptyEventList();
		}
	}

	/**
	 * Add friendly empty message if event list is empty
	 */
	emptyEventList() {
		if (this.eventList.length === 0) {
			this.elements.list.html(`<tr>
				<td colspan="4">There currently are no events scheduled.</td>
			</tr>`);
		}
	}

	/**
	 * Delete event from the scheduler
	 * @param {number} id
	 * @param {Event} evt
	 */
	delete(id, evt) {
		evt.preventDefault();

		let update = {
			deleted: true
		};
		this.socket.emit('schedule_update_item', id, update, clean => {
			this.updateCache(id, {}, true);
			this.findElm(id).remove();
			this.emptyEventList();
		});
	}

	/**
	 * Checks if the event is disabled or not
	 * @param {number} id
	 */
	isDisabled(id) {
		return this.getEvent(id).disabled;
	}

	/**
	 * Get an event
	 * @param {number} id
	 */
	getEvent(id) {
		const event = this.eventList.find(x => x.id === id);
		if (!event) {
			throw new Error(`Invalid event ${id}.`);
		}

		return event;
	}

	/**
	 * Disable an event
	 * @param {number} id
	 * @param {Event} evt
	 */
	disable(id, evt) {
		evt.preventDefault();
		let update = {
			disabled: !this.isDisabled(id)
		};

		this.socket.emit('schedule_update_item', id, update, clean => {
			this.updateCache(clean.id, clean);
			this.disableElm(clean.disabled, evt.target);
		});
	}

	/**
	 * Find the index of the event in the event_list
	 * @param {number} id
	 * @access protected
	 */
	findIndex(id) {
		return this.eventList.findIndex(x => x.id === id);
	}

	/**
	 * Updates the client side event cache
	 * @param {number} id
	 * @param {Object} data Clean data, this should be returned from the server to ensure everything is consistent
	 * @param {boolean} deleted True to remove this event from cache
	 * @access protected
	 */
	updateCache(id, data, deleted = false) {
		const idx = this.findIndex(id);
		if (deleted) {
			if (idx !== -1) {
				this.eventList.splice(idx, 1);
			}
		} else if (idx === -1) {
			this.eventList.push(data);
		} else {
			this.eventList[idx] = data;
		}
	}

	/**
	 * Disable/enable the event element
	 * @param {boolean} status
	 * @param {Element|jQuery} elm
	 */
	disableElm(status, elm) {
		let enableClass = 'btn-ghost-success',
			disableClass = 'btn-ghost-warning',
			disableName = 'disable',
			enableName = 'enable';
		if (status) {
			$(elm).addClass(enableClass)
				.removeClass(disableClass)
				.html(enableName);
		} else {
			$(elm).addClass(disableClass)
				.removeClass(enableClass)
				.html(disableName);
		}
	}

	/**
	 * Returns the jQuery element based on event id
	 * @param {number} eventId
	 * @return {jQuery}
	 */
	findElm(eventId) {
		return this.elements.list.find(`[data-event-id=${eventId}]`);
	}

	/**
	 * Add an event in the front end schedule list
	 * @param {Object} item
	 * @param {?number} replaceId
	 */
	eventIteam(item, replaceId = null) {
		let lastRun = '';
		let elmUpdate;

		if (item.lastRun !== null) {
			lastRun = `<br><small>Last run: ${moment(item.lastRun).format(this.dateFormat)}<small>`;
		}

		let template = $(`<tr data-event-id="${item.id}">
			<td>${item.title}</td>
			<td>
				${item.configDesc}
				${lastRun}
			</td>
			<td><canvas width="72" height="72" data-schedule-bank="${item.button}"></canvas></td>
			<td class="scheduleActions"></td>
		</tr>`);

		let delElm = $('<a href="#" class="btn btn-sm btn-ghost-danger">delete</a>').on('click', this.delete.bind(this, item.id));
		let disElm = $('<a href="#" class="btn btn-sm btn-ghost-warning">disable</a>').on('click', this.disable.bind(this, item.id));
		if (item.disabled) {
			this.disableElm(item.disabled, disElm);
		}
		let editElm = $('<a href="#" class="btn btn-sm btn-primary">edit</a>').on('click', this.editEvent.bind(this, item.id));

		template.find('.scheduleActions').append(delElm, disElm, editElm);

		if (replaceId !== null) {
			elmUpdate = this.findElm(replaceId);
		}
		if (replaceId === null || elmUpdate.length === 0) {
			this.elements.list.append(template);
		} else {
			elmUpdate.replaceWith(template);
		}

		this.previewWatch(item.button);
	}
}

$(() => new schedule_frontend(socket));
