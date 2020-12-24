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

var instance = {};
var instance_status = {};
var instance_variables = {};
var instance_variabledata = {};
var instance_manufacturer = {};
var instance_category = {};
var instance_name = {};

$(function() {
	var iconfig = {};
	var current_instance;

	var debug = function () {}; // console.log;
	$("#instanceConfigTab").hide();

	socket.emit('instance_get');
	socket.emit('instance_status_get');

	function show_module_help(name) {
		socket.emit('instance_get_help', name);
		socket.once('instance_get_help:result', function (err, result) {
			if (err) {
				alert('Error getting help text');
				return;
			}
			if (result) {
				var $helpModal = $('#helpModal');
				$helpModal.find('.modal-title').html('Help for ' + name);
				$helpModal.find('.modal-body').html(result);
				$helpModal.modal();
			}
		});
	}

	function updateInstanceStatus() {
		for (var x in instance_status) {

			var s = instance_status[x];

			// disabled
			if (s[0] === -1) {
				$("#instance_status_"+x).html('Disabled').attr('title', '').removeClass('instance-status-ok').removeClass('instance-status-warn').removeClass('instance-status-error').addClass('instance-status-disabled');
			}

			// ok
			if (s[0] === 0) {
				$("#instance_status_"+x).html('OK').attr('title', '').removeClass('instance-status-error').removeClass('instance-status-warn').removeClass('instance-status-disabled').addClass('instance-status-ok')
			}

			// warning
			else if (s[0] === 1) {
				$("#instance_status_"+x).html(""+s[1]).attr('title', s[1]).removeClass('instance-status-ok').removeClass('instance-status-error').removeClass('instance-status-disabled').addClass('instance-status-warn')
			}

			// error
			else if (s[0] === 2) {
				$("#instance_status_"+x).html("ERROR").attr('title', s[1]).removeClass('instance-status-ok').removeClass('instance-status-warn').removeClass('instance-status-disabled').addClass('instance-status-error')
			}

			// unknown
            else if (s[0] === null) {
                $("#instance_status_"+x).html(""+s[1]).attr('title', s[1]).removeClass('instance-status-ok').removeClass('instance-status-error').removeClass('instance-status-disabled').removeClass('instance-status-warn')
            }

		}
	}

	socket.on('instance_status', function(obj) {
		instance_status = obj;
		updateInstanceStatus();
	});

	function updateInstanceList(list, dontclear) {
		var $il = $("#instanceList");
		if (!dontclear) $il.html("");

		for (var n in list) {
			var i = list[n];

			if (i.instance_type == 'bitfocus-companion') {
				continue;
			}

			var $tr = $("<tr></tr>");

			var $td_id = $("<td></td>");
			var $td_label = $("<td id='label_"+n+"'></td>");
			var $td_status = $("<td id='instance_status_"+n+"'></td>");
			var $td_actions = $("<td></td>");

			var $button_edit = $("<button type='button' data-id='"+n+"' class='instance-edit btn btn-primary'>edit</button>");
			var $button_delete = $("<button type='button' data-id='"+n+"' class='instance-delete btn btn-sm btn-ghost-danger'>delete</button>");
			var $button_disable = $("<button type='button' data-id='"+n+"' class='instance-disable btn btn-sm btn-ghost-warning'>disable</button>");
			var $button_enable = $("<button type='button' data-id='"+n+"' class='instance-enable btn btn-sm btn-ghost-success'>enable</button>");

			$td_actions.append($button_delete)
			$td_actions.append($("<span>&nbsp;</span>"));

			if (i.enabled === undefined || i.enabled === true) {
				$td_actions.append($button_disable)
				$button_edit.show();
			}

			else if (i.instance_type !== 'bitfocus-companion') {
				$td_actions.append($button_enable);
				$button_edit.hide();
			}

			$td_actions.append($("<span>&nbsp;</span>"));

			$td_actions.append($button_edit);

			$button_delete.click(function() {
				if (confirm('Delete instance?')) {
					var id = $(this).data('id');
					$("#instanceConfigTab").hide();
					socket.emit('instance_delete', id);
					$(this).parent().parent().remove();
				}
			});

			$button_edit.click(function() {
				var id = $(this).data('id');
				socket.emit('instance_edit', id);
			});

			$button_disable.click(function() {
				var id = $(this).data('id');
				socket.emit('instance_enable', id, false);
			});

			$button_enable.click(function() {
				var id = $(this).data('id');
				socket.emit('instance_enable', id, true);
			});

			for (var x in instance.module) {
				if (instance.module[x].name == list[n].instance_type) {
					var help = '';
					if (instance.module[x].help) {
						help = '<div class="instance_help"><i class="fa fa-question-circle"></i></div>';
					}
					$td_id.html(help + "<b>"+instance.module[x].shortname+"</b>" + "<br>" + instance.module[x].manufacturer);
				}
			}


			if (list[n].label !== undefined) {
				$td_label.text(list[n].label);
			}

			$tr.append($td_id);
			$tr.append($td_label);
			$tr.append($td_status);
			$tr.append($td_actions);

			(function (name) {
				$tr.find('.instance_help').click(function () {
					show_module_help(name);
				});
			})(list[n].instance_type);

			$il.append($tr);

		}
		updateInstanceStatus();
	};

	function validateNumericField($opt) {

		// Note: $opt.val() will make non-numeric values ''.
		var val = $opt.val();
		var valid = true;

		var min = $opt.attr('min');
		var max = $opt.attr('max');

		if (val === '') {
			// Empty values are only permitted if the field isn't required
			valid = $opt.prop('required') === false;
		} else {

			if (min !== undefined) {
				valid &= val >= parseInt(min);
			}
			if (max !== undefined) {
				valid &= val <= parseInt(max);
			}

		}

		if (valid) {
			$opt.css('color', 'black');
			$opt.data('valid', true);
		} else {
			$opt.css('color', 'red');
			$opt.data('valid', false);
		}

	}


	// search for add instance code

	var $aisf = $('#instance_add_search_field');
	var $aisr = $('#instance_add_search_results');
	$aisr.html("");
	$aisf.val("");
	$aisf.on('keyup', function() {

		if ($aisf.val().length > 0) {
			$aisr.html("");

			for (var x in instance_name) {

				var main_split = instance_name[x].split(":");
				var manuf = main_split[0];
				var prods = main_split[1].split(";");

				for (var prod in prods) {
					var subprod = manuf + " " + prods[prod];

					if (subprod.match( new RegExp( $aisf.val(), "i" ))) {

						var $x = $("<div class='ais_entry'>&nbsp;<span style=''>"+subprod+"</span></div>");
						var $button = $('<a role="button" class="btn btn-primary text-white">Add</a>');

						$x.prepend($button);
						$x.data('id', x);
						$x.data('product', prods[prod]);

						var $help = $('<div class="instance_help"><i class="fa fa-question-circle"></i></div>')

						for (var y in instance.module) {
							if (instance.module[y].name == x) {
								if (instance.module[y].help) {
									$x.append($help);
								}
							}
						}

						$help.click(function (e) {
							e.stopPropagation();
							e.preventDefault();
							var id = $(this).parents('div').first().data('id');

							show_module_help(id);
						});

						$button.click(function(e) {
							e.preventDefault();
							var instance_type = $(this).parents('div').first().data('id');
							var product = $(this).parents('div').first().data('product');
							socket.emit('instance_add', { type: instance_type, product: product });
							$aisr.html("");
							$aisf.val("");

							socket.once('instance_add:result', function(id,db) {
								instance.db = db;
								socket.emit('instance_edit', id);
							});

						});

						$aisr.append($x);

					}

				}

			}

		}

		else {
			$aisr.html("");
		}

	});

	// add instance code
	$(".add-instance-ul").on('click', '.instance-addable', function() {
		var instance_type = $(this).data('id');
		var product = $(this).data('product');
		socket.emit('instance_add', { type: instance_type, product: product });

		socket.once('instance_add:result', function(id,db) {
			instance.db = db;
			socket.emit('instance_edit', id);
		});

	});

	socket.on('instance', function(i,obj) {
		instance = i;

		instance_manufacturer = obj.manufacturer;
		instance_category = obj.category;
		instance_name = obj.name;

		updateInstanceList(i.db);

		$addInstance = $("#addInstance");
		$addInstanceByManufacturer = $("#addInstanceByManufacturer");

		function compareCaseInsensitive(a, b){
			var a2 = a.toLowerCase();
			var b2 = b.toLowerCase();
			if (a2 < b2) {return -1;}
			if (a2 > b2) {return 1;}
			return 0;
		}

		function compileChildNodes(obj, $instanceListElm) {
			const category_names = Object.keys(obj).sort(compareCaseInsensitive)
			for (var n of category_names) {

				var $entry_li = $('<li class="dropdown-submenu"></li>');
				var $entry_title = $('<div tabindex="-1" class="dropdown-content"></div>');

				$entry_title.text(n);
				$entry_li.append($entry_title);
				$instanceListElm.append($entry_li);

				var $entry_sub_ul = $('<ul class="dropdown-menu"></ul>');

				var child_elms = []
				for ( var sub in obj[n] ) {

					var inx = obj[n][sub];
					var res_id = inx;
					var res_name = instance_name[inx];
					var main_split = res_name.split(":");
					var manuf = main_split[0];
					var prods = main_split[1].split(";");

					for (var prod in prods) {
						var subprod = manuf + " " + prods[prod];
						var $entry_sub_li = $('<li><div class="dropdown-content instance-addable" data-id="'+res_id+'" data-product="'+prods[prod]+'">'+subprod+'</div></li>');
						child_elms.push({
							name: manuf + " " + prods[prod],
							elm: $entry_sub_li
						})
					}
				}

				child_elms.sort((a, b) => compareCaseInsensitive(a.name, b.name))
				for ( var elm of child_elms ) {
					$entry_sub_ul.append(elm.elm);
				}

				$entry_li.append($entry_sub_ul);

			}
		}

		if (instance_category !== undefined) {
			compileChildNodes(instance_category, $addInstance)
		}

		if (instance_manufacturer !== undefined) {
			compileChildNodes(instance_manufacturer, $addInstanceByManufacturer)
		}

	});

	socket.on('instance_db_update', function(db) {
		instance.db = db;
		updateInstanceList(instance.db);
	});

	function saveConfig(button, id) {
		var $icf = $("#instanceConfigFields");
		var $button = $(button);
		var ok = true;
		var data = {};

		$icf.find('.instanceConfigField').each( function () {

			var $this = $(this);

			if (!ok) {
				return;
			}

			if ($this.data('valid') === false) {
				console.log("Invalid data in ", this);
				ok = false;
				return;
			}

			if ($this.data('type') == 'textinput') {
				data[$this.data('id')] = $this.val();
			}

			else if ($this.data('type') == 'dropdown') {
				data[$this.data('id')] = $this.val();
			}

			else if ($this.data('type') == 'dropdown-native') {
				data[$this.data('id')] = $this.val();
			}

			else if ($this.data('type') == 'checkbox') {
				data[$this.data('id')] = $this.prop('checked');
			}

			else if ($this.data('type') == 'number') {
				// Ensure only numeric or empty values get saved.
				// Handles situation where a string is entered into a non-required numeric field.
				var val = parseInt($this.val());
				val = isNaN(val) ? '' : val;
				$this.val(val);
				data[$this.data('id')] = val;
			}

			else {
				console.log("saveConfig: Unknown field type: ", $this.data('type'), this);
			}

		});

		if (ok) {

			socket.emit('instance_config_put', id, data);

			socket.once('instance_config_put:result', function (err, res) {

				if (res) {
					current_instance = data.label;
					$button.css('backgroundColor', 'lightgreen');
					setTimeout(function () {
						$button.css('backgroundColor', '');
					}, 300);
				}

				else {

					if (err == 'duplicate label') {
						var $field = $icf.find('input[data-id="label"]');
						$field.css('backgroundColor', 'red');
						setTimeout(function () {
							$field.css('backgroundColor', '');
						}, 500);

						alert('The label "' + data.label + '" is already in use. Please use a unique name for this module instance');
					}

				}

			});

		}

		else {
			$button.css('backgroundColor', 'red');
			setTimeout(function () {
				$button.css('backgroundColor', '');
			}, 500);
		}

	}

	function showInstanceVariables() {

		var $icv = $('#instanceConfigVariables');
		var $icvl = $('#instanceConfigVariableList');

		if (instance_variables[current_instance] !== undefined && instance_variables[current_instance].length > 0) {
			$icv.show();
			$icvl.html('');

			for (var i in instance_variables[current_instance]) {
				var variable = instance_variables[current_instance][i];
				$icvl.append('<tr data-id="' + current_instance + ':' + variable.name + '"><td>$(' + current_instance + ':' + variable.name + ')</td><td>' + variable.label + '</td><td>' + instance_variabledata[current_instance + ':' + variable.name] + '</td></tr>');
			}
		} else {
			$icv.hide();
		}
	}

	socket.emit('variable_instance_definitions_get');
	socket.on('variable_instance_definitions_get:result', function (err, data) {
		if (data) {
			instance_variables = data;
		}
	});

	socket.on('variable_instance_definitions_set', function (label, variables) {
		instance_variables[label] = variables;

		if (label == current_instance) {
			showInstanceVariables();
		}
	});

	socket.emit('variables_get');

	socket.on('variables_get:result', function (err, data) {
		if (data) {
			instance_variabledata = data;
		}
		showInstanceVariables();
	});

	socket.on('variable_set', function (key, value) {
		var match = current_instance + ':';
		instance_variabledata[key] = value;
		$('#instanceConfigVariableList tr[data-id="' + key + '"] > td:nth-child(3)').text(value);
	});

	socket.on('instance_edit:result', function(id, store, res, config ) {

		$('#instanceConfigTab').show();
		$('#instanceConfigVariables').hide();
		$('#instanceConfigTab a[href="#instanceConfig"]').tab('show');

		for (var n in store.module) {
			if (store.module[n].name === store.db[id].instance_type) {

				var help = '';
				if (store.module[n].help) {
					help = '<div class="instance_help"><i class="fa fa-question-circle"></i></div>';
				}

				$('#instanceConfig h4:first').html(help + store.module[n].shortname + ' configuration');

				(function (name) {
					$('#instanceConfig').find('.instance_help').click(function () {
						show_module_help(name);
					});
				})(store.module[n].name);

			}
		}

		iconfig = config;

		current_instance = config.label;
		showInstanceVariables();

		var $icf = $("#instanceConfigFields");
		$icf.html("");

		for (var n in res) {
			var field = res[n];
			var regex = undefined;

			if (field.regex){
				var flags = field.regex.replace(/.*\/([gimy]*)$/, '$1');
				var pattern = field.regex.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
				regex = new RegExp(pattern, flags);
			}

			var $sm = $('<div class="fieldtype-'+field.type+' col-sm-'+field.width+'"><label>'+field.label+'</label></div>');

			if (field.type == 'text') {
				var $inp = $("<p></p>");
				$inp.html(field.value);
				if (field.tooltip !== undefined) {
					$inp.attr('title', field.tooltip);
				}
				$sm.append($inp);
			}


			else if (field.type == 'textinput') {
				var $inp = $("<input type='text' class='form-control instanceConfigField' data-type='"+field.type+"' data-id='"+field.id+"'>");

				if (field.tooltip !== undefined) {
					$inp.attr('title', field.tooltip);
				}

				$inp.val(field.default);

				(function(f1,f2,inp,reg) {
					inp.keyup(function(){
						if (f2 == 'label') {
							$("#label_"+ f1).text(inp.val());
						}

						if (reg === undefined || inp.val().match(reg) !== null) {
							this.style.color = "black";
							$(this).data('valid', true);
						}

						else {
							this.style.color = "red";
							$(this).data('valid', false);
						}

					});
				})(id,field.id,$inp,regex);

				$sm.append($inp);
			}

			else if (field.type === 'dropdown') {

				var $opt_input = $("<select class='instanceConfigField' data-type='"+field.type+"' data-id='"+field.id+"'></select>");
				$opt_input.data('valid', true);
				if (field.tooltip !== undefined) {
					$opt_input.attr('title', field.tooltip);
				}

				$sm.append($opt_input);

				var selectoptions = {
					theme: 'option',
					width: '100%',
					multiple: false,
					tags: false,
					maximumSelectionLength: 0,
					minimumResultsForSearch: -1
				};

				if (field.multiple === true) {
					selectoptions.multiple = true;
				}

				if (typeof field.minChoicesForSearch === 'number' && field.minChoicesForSearch >=0) {
					selectoptions.minimumResultsForSearch = field.minChoicesForSearch;
				}

				if (typeof field.maxSelection === 'number' && field.maxSelection >0) {
					selectoptions.maximumSelectionLength = field.maxSelection;
				}

				if (field.tags === true) {
					selectoptions.tags = true;
					if (typeof field.regex !== 'undefined') {
						var flags = field.regex.replace(/.*\/([gimy]*)$/, '$1');
						var pattern = field.regex.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
						let regex = new RegExp(pattern, flags);
						selectoptions.createTag = function (params) {
							if (regex.test(params.term) === false) {
								return null;
							}

							return {
								id: params.term,
								text: params.term
							}
						};
					}

				}

				$opt_input.select2(selectoptions);

				if (field.multiple === true && typeof field.minSelection === 'number' && field.minSelection >0) {
					let minsel = field.minSelection + 1;
					$opt_input.on('select2:unselecting', function (e) {
						if ($('.select2-selection__choice').length < minsel) {
							return false;
						}
					});
				}

				for (var x in field.choices) {
					var newOption = new Option(field.choices[x].label, field.choices[x].id, false, false);
					$opt_input.append(newOption);
				}

				// update the select2 element
				$opt_input.val(field.default);
				$opt_input.trigger('change');
			}


			else if (field.type == 'dropdown-native') {
				var $inp = $("<select class='form-control instanceConfigField' data-type='"+field.type+"' data-id='"+field.id+"'>");

				if (field.tooltip !== undefined) {
					$inp.attr('title', field.tooltip);
				}

				$inp.data('valid', true);

				for (var i = 0; i < field.choices.length; ++i) {
					$inp.append('<option value="' + field.choices[i].id + '">' + field.choices[i].label + '</option>');
				}

				$inp.val(field.default);

				$sm.append($inp);
			}

			else if (field.type == 'checkbox') {
				var $opt_checkbox = $("<input type='checkbox' class='form-control instanceConfigField'>");

				if (field.tooltip !== undefined) {
					$opt_checkbox.attr('title', field.tooltip);
				}

				// Force as a boolean
				field.default = field.default === true;

				$opt_checkbox
					.attr('data-id', field.id)
					.data('type', 'checkbox')
					.data('valid', true)
					.prop('checked', field.default);

				$sm.append($opt_checkbox);

			}

			else if (field.type == 'number') {
				let $opt_num = $("<input type='number' class='form-control instanceConfigField'>");

				if (field.tooltip !== undefined) {
					$opt_num.attr('title', field.tooltip);
				}

				$opt_num
					.attr('data-id', field.id)
					.attr('min', field.min)
					.attr('max', field.max)
					.prop('required', field.required === true)
					.data('type', 'number')
					.val(field.default);

				(function(field, $opt) {
					$opt.on('change keyup', function() {
						// Run custom validation on the number field that changed
						validateNumericField($opt);
					});
				})(field, $opt_num);

				$sm.append($opt_num);

			}


			else {
				console.log("FIELD:" ,field);
			}

			$icf.append($sm);
		}

		$(".instanceConfigField").each(function() {

			var $this = $(this);

			var key  = $this.data('id');
			var type = $this.data('type');

			if (config[key] !== undefined) {

				if (type == 'checkbox') {
					$this.prop('checked', config[key]);

				} else if (type == 'number') {
					$this.val(config[key]);
					// Make sure the value returned from the instance is valid
					validateNumericField($this);

				} else if (type === 'dropdown') {

					// Get selected values and store them into an array
					var selections = [];
					if (typeof config[key] === 'string' || typeof config[key] === 'number') {
						selections.push(config[key]);
					}
					else if (Array.isArray(config[key])) {
						selections = config[key];
					}

					// Check if dropdown has all the selected options, if not create
					for (var sel in selections) {
						console.log('check for option', selections[sel], 'find', $this.find('option[value="' + selections[sel] + '"]'));
						if ($this.find('option[value="' + selections[sel] + '"]').length < 1) {
							var newOption = new Option(selections[sel], selections[sel], true, true);
							$this.append(newOption).trigger('change');
							console.log('not found, appending');
						}
					}

					// Set stored selection (works with single values and arrays)
					$this.val(config[key]);

				} else {
					$this.val(config[key]);
				}
			}

		});

		var $button = $('<button class="btn btn-primary" type="button" id="config_save">Apply changes</button>');
		var $bcontainer = $('<div class="col-lg-12 col-sm-12 col-xs-12"></div>');
		var $brow = $('<div class="row padtop"></div>')

		$bcontainer.append($button);
		$brow.append($bcontainer);

		$('#config_save').remove();
		$('#instanceConfigButtons').append($brow);

		$button.click(function () {
			saveConfig(this, id);
		});

		updateInstanceList(store.db);

	});

	socket.on('instance_get:result', function(instance_list) {

		for (var n in instance_list.db) {
			var instance = instance_list.db[n];
		}

	});

	socket.on('config_fields:result', function(id, fields, config) {
		socket.emit('instance_get');
	});

	$(".addInstance").click(function() {
		socket.emit('instance_add', { type: $(this).data('id'), product: $(this).data('product') });
		$("#elgbuttons").click();
	});

});
