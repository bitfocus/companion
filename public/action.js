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

var actionlist = {};

function int2hex(number) {
	var r = ('0' + ((number >> 16) & 0xff).toString('16')).substr(-2);
	var g = ('0' + ((number >> 8) & 0xff).toString('16')).substr(-2);
	var b = ('0' + (number & 0xff).toString('16')).substr(-2);

	return '#' + r + g + b;
}

function hex2int(hex) {
	return parseInt(hex.substr(1), 16);
}

$(function() {
	socket.emit('get_actions');

	var $aba = $("#addBankAction");
	$aba.select2({
		theme: 'option',
		width: '100%',
		minimumResultsForSearch: 9
	});

	$aba.change(function() {
		console.log('add',$(this).val() )
		socket.emit('bank_action_add', page, bank, $(this).val() );
		$("#addBankAction").val($("#addBankAction option:first").val());
	});

	$('#bankActions').on('keyup', '.action-delay-keyup', function() {
		socket.emit('bank_update_action_delay', page, bank,  $(this).data('action-id'), $(this).val() );
	});

	$('#bankActions').on('keyup', '.action-option-keyup', function() {
		var regex = $(this).data('option-regex');

		if (regex === undefined || $(this).val().match(regex) != null) {
			this.style.color = "black";
			socket.emit('bank_update_action_option', page, bank,  $(this).data('action-id'), $(this).data('option-id'), $(this).val() );
		} else {
			this.style.color = "red";
		}
	});



	$('#bankActions').on('change', '.action-option-change', function() {
		socket.emit('bank_update_action_option', page, bank,  $(this).data('action-id'), $(this).data('option-id'), $(this).val() );
	});

	$('#bankActions').on('change', '.action-checkbox', function() {
		socket.emit('bank_update_action_option', page, bank, $(this).data('action-id'), $(this).data('option-id'), $(this).prop('checked') );
	});

	$('#bankActions').on('change', '.action-number', function() {

		var $this = $(this);
		let min   = parseFloat($this.attr('min'));
		let max   = parseFloat($this.attr('max'));
		let value = parseFloat($this.val());

		if (!$this.prop('required') && isNaN(value)) {
			// Not required and isn't a number (could be empty).
			this.style.color = 'black';
		} else if (!isNaN(parseFloat(value)) && isFinite(value) && value >= min && value <= max) {
			// Is required and the value is a number within range.
			this.style.color = 'black';
		} else {
			this.style.color = 'red';
			return;
		}

		if (isNaN(value)) {
			// The value was empty (not required) and cast to a float, which makes it NaN.
			// Set it to an empty string and store that.
			value = '';
		}

		// If 'option.range === true' this option will contain both number and a range input types.
		// Keep both options' values in sync.
		$this.parents('.action-number-row').find('.action-number').each(function(index, element) {
			$(element).val(value);
		});

		socket.emit('bank_update_action_option', page, bank, $this.data('action-id'), $this.data('option-id'), value);

	});

	$("#testBankButton").on('mousedown', function() {
		socket.emit('hot_press',page,bank, true);
	});
	$("#testBankButton").on('mouseup', function() {
		socket.emit('hot_press',page,bank, false);
	});

	socket.on('bank_actions_get:result', function(page, bank, actions) {

		$ba = $("#bankActions");
		$ba.html("");

		var $table = $("<table class='table action-table'></table>");
		var $trth = $("<thead><tr><th></th><th colspan=2>Action</th><th style='width:90px'>Delay</th><th>Options</th></tr></thead>");
		var $tbody = $("<tbody></tbody>");
		$table.append($trth);

		if (actions.length) {
			$("#testBankButton").show();
		}
		else {
			$("#testBankButton").hide();
		}

		for (var n in actions) {
			var action = actions[n];
			if (action !== null && instance.db[action.instance] !== undefined) {


				var idb = instance.db[action.instance];
				var it = instance.db[action.instance].instance_type;
				var inst = action;

				var $tr = $("<tr></tr>");
				$tr.data("id", action.id);

				var name;

				if (actionlist[action.label] === undefined ) {
					var extract = action.label.split(/:/);
					var a = extract.shift();
					a = extract.shift();
					name = instance.db[action.instance].label + ": " + a + " <em>(undefined)</em>";
				}
				else {
					name = instance.db[action.instance].label + ": " + actionlist[action.label].label;
				}

				var $name_td = $("<td class='actionlist-td-label'>" + name + "</td>");
				var $del_td = $("<td class='actionlist-td-delete'><button type='button' class='btn btn-primary btn-sm'><span class='text-white fa fa-trash'></span></button></td>");
				var $reorder_grip = $("<td class='actionlist-td-reorder'><i class='fa fa-sort reorder-grip'></i></td>");
				var $delay_td = $("<td class='actionlist-td-delay'></td>");
				var $delay_input = $("<input type='text' value='' class='form-control action-delay-keyup' placeholder='ms'>");
				$delay_input.data('action-id', action.id);

				$delay_td.append($delay_input);

				$delay_td.find('input').val(inst.delay)
				var $options = $("<td class='actionlist-td-options'></td>");

				$tr.append($reorder_grip);
				$tr.append($del_td);
				$tr.append($name_td);
				$tr.append($delay_td);

				var iopt = actionlist[inst.label];

				if (iopt !== undefined && iopt.options !== undefined) {
					var options = iopt.options;

					for (var n in options) {
						var option = options[n];


						var $opt_label = $("<label>"+option.label+"</label>");
						$opt_label.css('clear','both');
						$opt_label.css('display','block');
						$opt_label.css('paddingTop', '5px');
						$opt_label.css('paddingBottom', '5px');
						$options.append($opt_label);

						if (option.type == 'textinput') {
							var $opt_input = $("<input type='text' class='action-option-keyup form-control'>");
							if (option.tooltip !== undefined) {
								$opt_input.attr('title', option.tooltip);
							}
							$opt_input.data('action-id', action.id);
							$opt_input.data('option-id', option.id);

							var regex = undefined;
							if (option.regex){
								var flags = option.regex.replace(/.*\/([gimy]*)$/, '$1');
								var pattern = option.regex.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
								regex = new RegExp(pattern, flags);

								$opt_input.data('option-regex', regex);
							}

							// if options never been stored on this action
							if (action.options === undefined) {
								action.options = {};
							}

							// if this option never has been saved, set default
							if (action.options[option.id] === undefined) {
								socket.emit('bank_update_action_option', page, bank, action.id, option.id, option.default);
								$opt_input.val(option.default);
							}

							// else set the db value for this option.
							else {
								$opt_input.val( action.options[option.id] );
							}

							$options.append($opt_input);

						}

						else if (option.type == 'colorpicker') {
							var $opt_input = $("<input type='text' class='action-option-keyup form-control'>");


							$opt_input.data('action-id', action.id);
							$opt_input.data('option-id', option.id);

							// if options never been stored on this action
							if (action.options === undefined) {
								action.options = {};
							}

							// if this option never has been saved, set default
							if (action.options[option.id] === undefined) {
								socket.emit('bank_update_action_option', page, bank, action.id, option.id, option.default || 0 );
								$opt_input.val(option.default || 0);
							}

							// else set the db value for this option.
							else {
								console.log("db value", action.options[option.id] )
								$opt_input.val( action.options[option.id] );
							}

							$options.append($opt_input);

							(function(f_page,f_bank,f_aid,f_oid) {
								console.log("db value", action.options[f_oid] )

								$opt_input.spectrum({

									color: int2hex($opt_input.val()),
									preferredFormat: "rgb",
									showInput: true,
									showPalette: true,
									palette: picker_colors,
									showButtons: false,

									change: function(color) {
										socket.emit('bank_update_action_option', f_page, f_bank, f_aid, f_oid, hex2int( color.toHexString() ));
									},

									move: function(color) {
										socket.emit('bank_update_action_option', f_page, f_bank, f_aid, f_oid, hex2int( color.toHexString() ));
									}

								});
							})(page, bank, action.id, option.id);

						}

						else if (option.type == 'dropdown-native') {

							var $opt_input = $("<select class='action-option-change form-control'></select>");
							$opt_input.data('action-id', action.id);
							$opt_input.data('option-id', option.id);
							if (option.tooltip !== undefined) {
								$opt_input.attr('title', option.tooltip);
							}

							for (var x in option.choices) {
								var str = new String(option.choices[x].label);
								var $opt_choice = $("<option value='"+ option.choices[x].id + "'>" + str + "</option>");
								$opt_choice.data('id', option.choices[x].id);
								$opt_input.append($opt_choice);
							}


							// if options never been stored on this action
							if (action.options === undefined) {
								action.options = {};
							}

							// if this option never has been saved, set default
							if (action.options[option.id] === undefined) {
								socket.emit('bank_update_action_option', page, bank, action.id, option.id, option.default);
								$opt_input.val(option.default);
							}

							// else set the db value for this option.
							else {
								$opt_input.val( action.options[option.id] );
							}

							$options.append($opt_input);

						}

						else if (option.type === 'dropdown') {

							var $opt_input = $("<select class='action-option-change'></select>");
							$opt_input.data('action-id', action.id);
							$opt_input.data('option-id', option.id);
							if (option.tooltip !== undefined) {
								$opt_input.attr('title', option.tooltip);
							}

							$options.append($opt_input);

							var selectoptions = {
								theme: 'option',
								width: '100%',
								multiple: false,
								tags: false,
								maximumSelectionLength: 0,
								minimumResultsForSearch: -1
							};

							if (option.multiple === true) {
								selectoptions.multiple = true;
							}

							if (typeof option.minChoicesForSearch === 'number' && option.minChoicesForSearch >=0) {
								selectoptions.minimumResultsForSearch = option.minChoicesForSearch;
							}

							if (typeof option.maxSelection === 'number' && option.maxSelection >0) {
								selectoptions.maximumSelectionLength = option.maxSelection;
							}

							if (option.tags === true) {
								selectoptions.tags = true;
								if (typeof option.regex !== 'undefined') {
									var flags = option.regex.replace(/.*\/([gimy]*)$/, '$1');
									var pattern = option.regex.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
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

							if (option.multiple === true && typeof option.minSelection === 'number' && option.minSelection >0) {
								let minsel = option.minSelection + 1;
								$opt_input.on('select2:unselecting', function (e) {
									if ($('.select2-selection__choice').length < minsel) {
										return false;
									}
								});
							}

							// if options never been stored on this action
							if (action.options === undefined) {
								action.options = {};
							}

							// if this option never has been saved, set default
							if (action.options[option.id] === undefined) {
								action.options[option.id] = option.default;
								socket.emit('bank_update_action_option', page, bank, action.id, option.id, option.default);
							}

							// populate select2 with choices
							var selections = [];
							if (typeof action.options[option.id] === 'string' || typeof action.options[option.id] === 'number') {
								selections.push(action.options[option.id].toString())
							}
							else if (Array.isArray(action.options[option.id])) {
								selections = action.options[option.id]
							}

							for (var x in option.choices) {
								var select = false;
								var pos = selections.indexOf(option.choices[x].id.toString());
								if (pos >= 0) { // if i find my option in the array of selections
									select = true; // select it
									selections.splice(pos,1); // and remove it from the array, the remaining selections are used later
								}
								var newOption = new Option(option.choices[x].label, option.choices[x].id, select, select);
								$opt_input.append(newOption);
							}

							// if there are selections left the db value is not a predefined choice, so options have to be created
							for (var x in selections) {
								var newOption = new Option(selections[x], selections[x], true, true); // option is always selected, otherwise it wouldn't have been stored
								$opt_input.append(newOption);
							}

							// update the select2 element
							$opt_input.trigger('change');
						}


						else if (option.type == 'multiselect') {

							var $opt_input = $("<select multiple class='action-option-change form-control'></select>");
							$opt_input.data('action-id', action.id);
							$opt_input.data('option-id', option.id);
							if (option.tooltip !== undefined) {
								$opt_input.attr('title', option.tooltip);
							}

							for (var x in option.choices) {
								var str = new String(option.choices[x].label);
								var $opt_choice = $("<option value='"+ option.choices[x].id + "'>" + str + "</option>");
								$opt_choice.data('id', option.choices[x].id);
								$opt_input.append($opt_choice);
							}


							// if options never been stored on this action
							if (action.options === undefined) {
								action.options = {};
							}

							// if this option never has been saved, set default
							if (action.options[option.id] === undefined) {
								socket.emit('bank_update_action_option', page, bank, action.id, option.id, option.default);
								$opt_input.val(option.default);
							}

							// else set the db value for this option.
							else {
								$opt_input.val( action.options[option.id] );
							}

							$options.append($opt_input);

						}

						else if (option.type == 'checkbox') {

							var $opt_checkbox = $("<input type='checkbox' class='action-checkbox form-control'>");
							if (option.tooltip !== undefined) {
								$opt_checkbox.attr('title', option.tooltip);
							}

							// Force as a boolean
							option.default = option.default === true;

							$opt_checkbox.data('action-id', action.id)
								.data('option-id', option.id);
								
							// if options never been stored on this action
							if (action.options === undefined) {
								action.options = {};
							}

							// if this option never has been saved, set default
							if (action.options[option.id] === undefined) {
								socket.emit('bank_update_action_option', page, bank, action.id, option.id, option.default);
								$opt_checkbox.prop('checked', option.default);
							}

							// else set the db value for this option.
							else {
								$opt_checkbox.prop('checked', action.options[option.id]);
							}

							$options.append($opt_checkbox);

						}

						else if (option.type == 'number') {

							// Create both the number and the range inputs.
							// The range will only be used if option.range is used.
							let $opt_num   = $('<input type="number" class="action-number form-control">');
							let $opt_range = $("<input type='range' class='action-number form-control'>");
							
							if (option.step !== undefined) {
								$opt_num.attr('step', option.step);
								$opt_range.attr('step', option.step);
							}

							if (option.tooltip !== undefined) {
								$opt_num.attr('title', option.tooltip);
								$opt_range.attr('title', option.tooltip);
							}

							$opt_num.data('action-id', action.id)
								.data('option-id', option.id)
								.attr('min', option.min)
								.attr('max', option.max)
								.prop('required', option.range || option.required === true);

							// if options never been stored on this action
							if (action.options === undefined) {
								action.options = {};
							}

							// if this option never has been saved, set default
							if (action.options[option.id] === undefined) {
								socket.emit('bank_update_action_option', page, bank, action.id, option.id, option.default);
								$opt_num.val(option.default);
							}

							// else set the db value for this option.
							else {
								$opt_num.val(action.options[option.id]);
							}

							
							if (option.range !== true) {

								$options.append(
									$('<div class="row action-number-row">').append([
										$('<div class="col-sm-12">').append($opt_num)
									])
								);

							}

							// else include the range input in the row too
							else {

								$opt_range.data('action-id', action.id)
									.data('option-id', option.id)
									.attr('min', option.min)
									.attr('max', option.max)
									.val($opt_num.val());

								$options.append(
									$('<div class="row action-number-row action-number-range-row">').append([
										$('<div class="action-number-range">').append($opt_range),
										$('<div class="action-number-number">').append($opt_num)
									])
								);

							}

						}

						else {
							console.log("UNKNOWN OPTION TYPE",option.type);
						}

					}

				}

				$tr.append($options);

				$del_td.click(function() {
					if (confirm('Delete action?')) {
						socket.emit('bank_action_delete', page, bank, $(this).parent().data('id'));
					}
				})
				$tbody.append($tr);

			}
		}
		if (actions.length > 0) {
			$table.append($tbody);
		}
		$ba.append($table);

		function translate_index(tr_index) {
			var index = -1
			for (var n in actions) {
				var action = actions[n]
				if (action !== null && instance.db[action.instance] !== undefined) {
					index++
				}
				if (index === tr_index) {
					return n
				}
			}
			return -1
		}

		new RowSorter($table[0], {
			handler: '.reorder-grip',
			onDrop: function(tbody, row, new_index, old_index) {
				var old_index2 = translate_index(old_index)
				var new_index2 = translate_index(new_index)

				if (old_index2 === -1 || new_index2 === -1) {
					alert("Failed to move action")
					return false
				}

				socket.emit('bank_update_action_option_order', page, bank, old_index2, new_index2);
				actions.splice(new_index2, 0, actions.splice(old_index2, 1)[0]);
			}
		});

	});

	socket.on('actions', function(actions) {

		actionlist = actions;
		var $ali = $("#actionsList");
		$aba.html("");
		$ali.html("");

		var $option = $("<option> + Add key down/on action</option>")
		$aba.append($option);

		for (var n in actions) {
			var x = n.split(/:/);
			var inst = x[0];
			var act = x[1];

			if (inst !== undefined && instance !== undefined && instance.db !== undefined && instance.db[inst] !== undefined) {

				var $option = $("<option value='"+n+"'>"+ instance.db[inst].label + ": "+actions[n].label+"</option>")
				$aba.append($option);

				var $li = $("<tr></tr>");
				var $td_id = $("<td></td>");
				var $td_label = $("<td></td>");

				$td_id.text(instance.db[inst].label);
				$td_label.text(actions[n].label);

				$li.append($td_id);
				$li.append($td_label);

				$ali.append($li);
			}

		}


	})
});