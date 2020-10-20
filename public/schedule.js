class schedule_frontend {
	/**
	 * @param {SocketIOClientStatic} socket
	 */
	constructor(socket) {
		this.date_format = 'MM/DD HH:mm:ss';
		this.socket = socket;
		this._editor_setup = false;
		this.preview_cache = {};
		this.event_list = [];

		this.elements = {
			list: $('#schedulerEventList'),
			new: $('#scheduleEditorNew'),
			modal: $('#scheduleModal'),
			config: $('#scheduleConfigurable'),
			type: $('#scheduleEditorType'),
			form: $('#scheduleModal').find('form')
		};
		this.form = null;

		this.elements.new.on('click', this.edit_event.bind(this, null));
		this.elements.form.on('submit', this.save_form.bind(this));
		this.socket.emit('schedule_plugins', this.load_plugins.bind(this));
		this.socket.on('schedule_preview_data', this.preview_update.bind(this));
	}

	/**
	 * Loads enabled plugins and begins watching for schedule events
	 * @param {Object[]} plugins
	 */
	load_plugins(plugins) {
		this.plugins = plugins;

		// Can't use these until plugins are loaded...
		this.socket.emit('schedule_get', this.load_schedule.bind(this));
		this.socket.on('schedule_refresh', this.load_schedule.bind(this));
	}

	/**
	 * Loads the editor modal
	 */
	_setup_editor() {
		if (this._editor_setup) {
			return;
		}

		this.plugins.forEach(p => {
			const type = p.type;
			let fields = $(`<div id="scheduleEditor${type}" class="scheduleConfig"></div>`);
			p.options.forEach(f => {
				let id = 'scheduleEditor' + type + f.key;
				let item = $(`<div class="form-group">
					<label for="${id}">${f.name}</label>
				</div>`);
				if (f.type === 'textinput') {
					let textinput = $(`<input type="text" name="${f.key}" class="form-control" id="${id}" placeholder="${f.placeholder}">`);
					if (!f.not_required) {
						textinput.attr('required', true);
					}
					if (f.pattern) {
						textinput.attr('pattern', f.pattern);
					}
					item.append(textinput);
				} else if (f.type === 'select') {
					let choices = $(`<select id="${id}" name="${f.key}" class="select2 form-control" style="width: 100%"></select>`);
					if (f.multi) {
						choices.attr('multiple', true);
					}
					if (!f.not_required) {
						choices.attr('required', true);
					}
					f.choices.forEach(c => {
						choices.append(`<option value="${c.id}">${c.label}</option>`);
					});
					item.append(choices);
				}
				fields.append(item);
			});
			this.elements.type.append(`<option value="${type}">${p.name}</option>`);
			this.elements.config.append(fields);
		});

		this._editor_setup = true;
	}

	/**
	 * Change plugin type and enable properties for editing
	 * @param {string} type
	 */
	change_type(type) {
		const elm_id = '#scheduleEditor' + type;
		$(`.scheduleConfig:not(${elm_id})`).hide()
			.find('input, select')
			.attr('disabled', true);
		$(elm_id).show()
			.find('input, select')
			.attr('disabled', false);
	}

	/**
	 * Edit event
	 * @param {number} event_id
	 */
	edit_event(event_id = null) {
		this._setup_editor();
		this.elements.form.trigger('reset');

		if (event_id !== null) {
			this.load_form(event_id);
		}
		this.edit_id = event_id;

		this.elements.modal.modal('show');

		this.elements.form.find('.select2').select2();
		this.elements.type.on('change', x => this.change_type(x.target.value))
			.trigger('change');
	}

	/**
	 * Load with configuration
	 * @param {number} event_id
	 */
	load_form(event_id) {
		let init_config = this.get_event(event_id);
		const config = $.extend(init_config, init_config.config);

		for (const name in config) {
			const elm = this.elements.form.find(`[name="${name}"]`);
			if (elm.length) {
				elm.val(config[name]);
			}
		}
	}

	/**
	 * Save form
	 * @param {Event} evt
	 */
	save_form(evt) {
		evt.preventDefault();

		this.form = new FormData(this.elements.form[0]);
		let send_data = {
			id: this.edit_id,
			title: this.form.get('title'),
			type: this.form.get('type'),
			button: this.form.get('button'),
			config: this.plugin_save()
		};

		this.socket.emit('schedule_save_item', send_data, clean => {
			if (this.edit_id !== null) {
				let init_config = this.get_event(this.edit_id);
				if (clean.button != init_config.button && $(`canvas[data-schedule-bank="${init_config.button}"]`).length === 1) {
					this.preview_update_stop(init_config.button);
				}
			}

			if (this.event_list.length === 0) {
				this.load_schedule([clean]);
			} else {
				this._update_cache(clean.id, clean);
				this.event_item(clean, clean.id);
			}

			this.elements.modal.modal('hide');
		});
	}

	/**
	 * Watch for previews
	 * @param {String} button
	 */
	preview_watch(button) {
		let [page, bank] = button.split('.');
		if (button in this.preview_cache) {
			if (this.preview_cache[button] !== null) { // May not have received the response yet
				this.preview_update(page, bank, this.preview_cache[button]);
			}
		} else {
			this.preview_cache[button] = null;
			this.socket.emit('scheduler_bank_preview', page, bank);
		}
	}

	/**
	 * Updates the preview image for the button number
	 * @param {String} page
	 * @param {String} bank
	 * @param {ArrayBuffer} img
	 */
	preview_update(page, bank, img) {
		this.preview_cache[`${page}.${bank}`] = img;

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
	preview_update_stop(button) {
		let [page, bank] = button.split('.');
		this.socket.emit('scheduler_bank_preview', page, bank, true);
		delete this.preview_cache[button];
	}

	/**
	 * Get the plugin of the type given
	 * @param {string} type
	 * @return {Object}
	 */
	get_plugin_type(type) {
		return this.plugins.find(p => p.type === type);
	}

	/**
	 * Get configuration from form that plugin accepts to save
	 * @return {Object}
	 */
	plugin_save() {
		let type = this.form.get('type');
		let config = {};
		const plugin = this.get_plugin_type(type);

		plugin.options.forEach(x => {
			let value;

			if (x.multi) {
				try {
					value = this.form.getAll(x.key)
						.filter(x => x !== null);
				} catch (e) {
					value = [];
				}
			} else {
				value = this.form.get(x.key);
			}

			config[x.key] = value;
		});

		return config;
	}

	/**
	 * Load event schedule list
	 * @param {Object[]} schedule_list Array of schedules received from the server
	 */
	load_schedule(schedule_list) {
		this.event_list = schedule_list;

		if (this.event_list.length) {
			this.elements.list.html('');
			this.event_list.forEach(i => this.event_item(i, null));
		} else {
			this.empty_event_list();
		}
	}

	/**
	 * Add friendly empty message if event list is empty
	 */
	empty_event_list() {
		if (this.event_list.length === 0) {
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
			this._update_cache(id, {}, true);
			this.find_elm(id).remove();
			this.empty_event_list();
		});
	}

	/**
	 * Checks if the event is disabled or not
	 * @param {number} id
	 */
	is_disabled(id) {
		return this.get_event(id).disabled;
	}

	/**
	 * Get an event
	 * @param {number} id
	 */
	get_event(id) {
		const event = this.event_list.find(x => x.id === id);
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
			disabled: !this.is_disabled(id)
		};

		this.socket.emit('schedule_update_item', id, update, clean => {
			this._update_cache(clean.id, clean);
			this.disable_elm(clean.disabled, evt.target);
		});
	}

	/**
	 * Find the index of the event in the event_list
	 * @param {number} id
	 */
	_find_index(id) {
		return this.event_list.findIndex(x => x.id === id);
	}

	/**
	 * Updates the client side event cache
	 * @param {number} id
	 * @param {Object} data Clean data, this should be returned from the server to ensure everything is consistent
	 * @param {boolean} deleted True to remove this event from cache
	 */
	_update_cache(id, data, deleted = false) {
		const idx = this._find_index(id);
		if (deleted) {
			if (idx !== -1) {
				this.event_list.splice(idx, 1);
			}
		} else if (idx === -1) {
			this.event_list.push(data);
		} else {
			this.event_list[idx] = data;
		}
	}

	/**
	 * Disable/enable the event element
	 * @param {boolean} status
	 * @param {Element|jQuery} elm
	 */
	disable_elm(status, elm) {
		let enable_class = 'btn-ghost-success',
			disable_class = 'btn-ghost-warning',
			disable_name = 'disable',
			enable_name = 'enable';
		if (status) {
			$(elm).addClass(enable_class)
				.removeClass(disable_class)
				.html(enable_name);
		} else {
			$(elm).addClass(disable_class)
				.removeClass(enable_class)
				.html(disable_name);
		}
	}

	/**
	 * Returns the jQuery element based on event id
	 * @param {number} event_id
	 * @return {jQuery}
	 */
	find_elm(event_id) {
		return this.elements.list.find(`[data-event-id=${event_id}]`);
	}

	/**
	 * Add an event in the front end schedule list
	 * @param {Object} item
	 * @param {?number} replace_id
	 */
	event_item(item, replace_id = null) {
		let last_run = '';
		let elm_update;

		if (item.last_run !== null) {
			last_run = `<br><small>Last run: ${moment(item.last_run).format(this.date_format)}<small>`;
		}

		let template = $(`<tr data-event-id="${item.id}">
			<td>${item.title}</td>
			<td>
				${item.config_desc}
				${last_run}
			</td>
			<td><canvas width="72" height="72" data-schedule-bank="${item.button}"></canvas></td>
			<td class="scheduleActions"></td>
		</tr>`);

		let del_elm = $('<a href="#" class="btn btn-sm btn-ghost-danger">delete</a>').on('click', this.delete.bind(this, item.id));
		let dis_elm = $('<a href="#" class="btn btn-sm btn-ghost-warning">disable</a>').on('click', this.disable.bind(this, item.id));
		if (item.disabled) {
			this.disable_elm(item.disabled, dis_elm);
		}
		let edit_elm = $('<a href="#" class="btn btn-sm btn-primary">edit</a>').on('click', this.edit_event.bind(this, item.id));

		template.find('.scheduleActions').append(del_elm, dis_elm, edit_elm);

		if (replace_id !== null) {
			elm_update = this.find_elm(replace_id);
		}
		if (replace_id === null || elm_update.length === 0) {
			this.elements.list.append(template);
		} else {
			elm_update.replaceWith(template);
		}

		this.preview_watch(item.button);
	}
}

$(() => new schedule_frontend(socket));
