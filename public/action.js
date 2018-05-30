var actionlist = {};

$(function() {
	socket.emit('get_actions');
	var $aba = $("#addBankAction");

	$aba.change(function() {
		socket.emit('bank_addAction', page, bank, $(this).val() );
		$("#addBankAction").val($("#addBankAction option:first").val());
	});

	$('#bankActions').on('keyup', '.action-option-keyup', function() {
		socket.emit('bank_update_action_option', page, bank,  $(this).data('action-id'), $(this).data('option-id'), $(this).val() );
	});

	$('#bankActions').on('change', '.action-option-change', function() {
		socket.emit('bank_update_action_option', page, bank,  $(this).data('action-id'), $(this).data('option-id'), $(this).val() );
	});


	socket.on('bank_getActions:result', function(page, bank, actions) {

		$ba = $("#bankActions");
		$ba.html("");

		var $table = $("<table class='table action-table'></table>");
		var $trth = $("<thead><tr><th>Delete</th><th>Action name</th><th>Options</th></tr></thead>");
		var $tbody = $("<tbody></tbody>");
		$table.append($trth);

		for (var n in actions) {
			var action = actions[n];
			if (action !== null && instance.db[action.instance] !== undefined) {


				var idb = instance.db[action.instance];
				var it = instance.db[action.instance].instance_type;
				var inst = action;

				var $tr = $("<tr></tr>");
				$tr.data("id", action.id);

				var $name_td = $("<td>" + instance.db[action.instance].label + ": " + actionlist[action.label].label + "</td>");
				var $del_td = $("<td><button type='button' class='btn btn-danger btn-sm'>delete</button><span>&nbsp;</span></td>");
				var $options = $("<td></td>");

				$tr.append($del_td);
				$tr.append($name_td);

				var iopt = actionlist[inst.label];

				if (iopt !== undefined && iopt.options !== undefined) {
					var options = iopt.options;

					for (var n in options) {
						var option = options[n];

						var $opt_label = $("<label>"+option.label+"</label>");
						$options.append($opt_label);




						if (option.type == 'textinput') {
							var $opt_input = $("<input type='text' class='action-option-keyup form-control'>");
							$opt_input.data('action-id', action.id);
							$opt_input.data('option-id', option.id);

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





						if (option.type == 'dropdown') {

							var $opt_input = $("<select class='action-option-change form-control'></select>");
							$opt_input.data('action-id', action.id);
							$opt_input.data('option-id', option.id);

							for (var x in option.choices) {
								var str = new String(option.choices[x]);
								var $opt_choice = $("<option value='"+x+"'>"+str.toString()+"</option>");
								$opt_choice.data('id', x);
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

					}

				}

				$tr.append($options);

				$del_td.click(function() {
					socket.emit('bank_delAction', page, bank, $(this).parent().data('id'));
				})
				$tbody.append($tr);

			}
		}
		$table.append($tbody);
		$ba.append($table);
	});

	socket.on('actions', function(actions) {

		actionlist = actions;
		var $ali = $("#actionsList");
		$aba.html("");
		$ali.html("");

		var $option = $("<option>[ Select action ]</option>")
		$aba.append($option);

		for (var n in actions) {
			var x = n.split(/:/);
			var inst = x[0];
			var act = x[1];

			if (inst !== undefined && instance.db[inst] !== undefined) {

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
