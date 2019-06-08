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

	$aba.change(function() {
		socket.emit('bank_addAction', page, bank, $(this).val() );
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

		if (!$this.attr('required') && isNaN(value)) {
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

	socket.on('bank_get_actions:result', function(page, bank, actions) {

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
				var $del_td = $("<td class='actionlist-td-delete'><button type='button' class='btn btn-danger btn-sm'>delete</button><span>&nbsp;</span></td>");
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

						else if (option.type == 'dropdown') {

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
							

							if (option.tooltip !== undefined) {
								$opt_num.attr('title', option.tooltip);
								$opt_range.attr('title', option.tooltip);
							}

							$opt_num.data('action-id', action.id)
								.data('option-id', option.id)
								.attr('min', option.min)
								.attr('max', option.max)
								.attr('required', option.range || option.required === true);

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
									$('<div class="row action-number-row">').append([
										$('<div class="col-sm-8">').append($opt_range),
										$('<div class="col-sm-4">').append($opt_num)
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
						socket.emit('bank_delAction', page, bank, $(this).parent().data('id'));
					}
				})
				$tbody.append($tr);

			}
		}
		if (actions.length > 0) {
			$table.append($tbody);
		}
		$ba.append($table);

		new RowSorter($table[0], {
			handler: '.reorder-grip',
			onDrop: function(tbody, row, new_index, old_index) {
				socket.emit('bank_update_action_option_order', page, bank, old_index, new_index);
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
