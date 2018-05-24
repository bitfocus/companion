var actionlist = {};

$(function() {
	socket.emit('get_actions');
	var $aba = $("#addBankAction");

	$aba.change(function() {
		socket.emit('bank_addAction', page, bank, $(this).val() );
		$("#addBankAction").val($("#addBankAction option:first").val());
	});

	socket.on('bank_getActions:result', function(page, bank, actions) {
		console.log("bank_getActions:result", page, bank, actions);

		$ba = $("#bankActions");
		$ba.html("");
		console.log("actions",actions);
		var $ol = $("<ol></ol>");
		for (var n in actions) {
			var action = actions[n];
			if (action !== null && instance.db[action.instance] !== undefined) {
				var $li = $("<li></li>");
				$li.data("id", action.id);
				console.log("YYYYYY", action, actionlist);
				$li.text(instance.db[action.instance].label + ": " + actionlist[action.label].label);
				var $del = $("<button type='button' class='btn btn-danger btn-sm'>delete</button><span>&nbsp;</span>");
				$li.prepend($del);
				$del.click(function() {
					socket.emit('bank_delAction', page, bank, $(this).parent().data('id'));
				})
				$ol.append($li);
			}
		}
		$ba.append($ol);

	});

	socket.on('actions', function(actions) {

		actionlist = actions;
		var $ali = $("#actionsList");
		$aba.html("");
		$ali.html("");

		var $option = $("<option>[ Select action ]</option>")
		$aba.append($option);

		console.log("actions:", actions);

		for (var n in actions) {
			var x = n.split(/:/);
			var inst = x[0];
			var act = x[1];

			if (inst !== undefined && instance.db[inst] !== undefined) {
				console.log("second", actions[n].label);
				var $option = $("<option value='"+n+"'>"+ instance.db[inst].label + ": "+actions[n].label+"</option>")
				$aba.append($option);

				var $li = $("<tr></tr>");
				var $td_id = $("<td></td>");
				var $td_label = $("<td></td>");
				$td_id.text(n);
				$td_label.text(actions[n].label);

				$li.append($td_id);
				$li.append($td_label);

				$ali.append($li);
			}

		}


	})
});
