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

var releaseactionlist = {};

$(function() {
	socket.emit('get_release_actions');

	var $aba = $("#addBankReleaseAction");

	$aba.change(function() {
		socket.emit('bank_addReleaseAction', page, bank, $(this).val() );
		$("#addBankReleaseAction").val($("#addBankReleaseAction option:first").val());
	});

	$('#bankReleaseActions').on('keyup', '.release-action-delay-keyup', function() {
		socket.emit('bank_update_release_action_delay', page, bank,  $(this).data('release-action-id'), $(this).val() );
	});

	$('#bankReleaseActions').on('keyup', '.release-action-option-keyup', function() {
		var regex = $(this).data('option-regex');

		if (regex === undefined || $(this).val().match(regex) != null) {
			this.style.color = "black";
			socket.emit('bank_update_release_action_option', page, bank,  $(this).data('release-action-id'), $(this).data('option-id'), $(this).val() );
		} else {
			this.style.color = "red";
		}
	});



	$('#bankReleaseActions').on('change', '.release-action-option-change', function() {
		socket.emit('bank_update_release_action_option', page, bank,  $(this).data('release-action-id'), $(this).data('option-id'), $(this).val() );
	});

	socket.on('bank_get_release_actions:result', function(page, bank, actions) {

		$ba = $("#bankReleaseActions");
		$ba.html("");

		var $table = $("<table class='table release-action-table'></table>");
		var $trth = $("<thead><tr><th colspan=2>Action</th><th style='width:90px'>Delay</th><th>Options</th></tr></thead>");
		var $tbody = $("<tbody></tbody>");
		$table.append($trth);
		console.log("actions!", actions);
		for (var n in actions) {
			var action = actions[n];
			if (action !== null && instance.db[action.instance] !== undefined) {


				var idb = instance.db[action.instance];
				var it = instance.db[action.instance].instance_type;
				var inst = action;

				var $tr = $("<tr></tr>");
				$tr.data("id", action.id);
				console.log("action...", action);
				console.log("instdb", instance.db);

				var $name_td = $("<td class='actionlist-td-label'>" + instance.db[action.instance].label + ": " + releaseactionlist[action.label].label + "</td>");
				var $del_td = $("<td class='actionlist-td-delete'><button type='button' class='btn btn-danger btn-sm'>delete</button><span>&nbsp;</span></td>");
				var $delay_td = $("<td class='actionlist-td-delay'></td>");
				var $delay_input = $("<input type='text' value='' class='form-control release-action-delay-keyup' placeholder='ms'>");
				$delay_input.data('release-action-id', action.id);

				$delay_td.append($delay_input);

				$delay_td.find('input').val(inst.delay)
				var $options = $("<td class='actionlist-td-options'></td>");

				$tr.append($del_td);
				$tr.append($name_td);
				$tr.append($delay_td);

				var iopt = releaseactionlist[inst.label];

				if (iopt !== undefined && iopt.options !== undefined) {
					var options = iopt.options;

					for (var n in options) {
						var option = options[n];


						var $opt_label = $("<label>"+option.label+"</label>");
						$options.append($opt_label);

						if (option.type == 'textinput') {
							var $opt_input = $("<input type='text' class='release-action-option-keyup form-control'>");
							if (option.tooltip !== undefined) {
								$opt_input.attr('title', option.tooltip);
							}
							$opt_input.data('release-action-id', action.id);
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
								socket.emit('bank_update_release_action_option', page, bank, action.id, option.id, option.default);
								$opt_input.val(option.default);
							}

							// else set the db value for this option.
							else {
								$opt_input.val( action.options[option.id] );
							}

							$options.append($opt_input);

						}


						if (option.type == 'dropdown') {

							var $opt_input = $("<select class='release-action-option-change form-control'></select>");
							$opt_input.data('release-action-id', action.id);
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
								socket.emit('bank_update_release_action_option', page, bank, action.id, option.id, option.default);
								$opt_input.val(option.default);
							}

							// else set the db value for this option.
							else {
								$opt_input.val( action.options[option.id] );
							}

							$options.append($opt_input);

						}

					}

				}

				$tr.append($options);

				$del_td.click(function() {
					if (confirm('Delete action?')) {
						socket.emit('bank_delReleaseAction', page, bank, $(this).parent().data('id'));
					}
				})
				$tbody.append($tr);

			}
		}
		if (actions.length > 0) {
			$table.append($tbody);
		}
		$ba.append($table);

		var old_index = undefined;
		$table.sortable({
			items: "tbody tr",
			accept: 'tbody tr',
			handle: '.actionlist-td-label',
			forcePlaceholderSize: true,
		}).on("sortable:activate", function(event, ui) {
			// Reorder started. Record current index.
			old_index = $(ui.item).index();
		}).on("sortable:update", function(event, ui) {
			// Reorder completed. Update position.
			socket.emit('bank_update_release_action_option_order', page, bank, old_index, ui.index);
		});

	});



	socket.on('actions', function(actions) {

		releaseactionlist = actions;
		var $ali = $("#releaseActionsList");
		$aba.html("");
		$ali.html("");

		var $option = $("<option> + Add key up/off action</option>")
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
