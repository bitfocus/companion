
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
			if (action !== null) {
				var $li = $("<li></li>");
				$li.data("id", action.id);
				$li.text(action.label);
				var $del = $("<button type='button'>delete</button>");
				$li.append($del);
				$del.click(function() {
					socket.emit('bank_delAction', page, bank, $(this).parent().data('id'));
				})
				$ol.append($li);
			}
		}
		$ba.append($ol);

	});

	socket.on('actions', function(actions) {

		console.log("actions", actions);
		var $ali = $("#actionsList");
		$aba.html("");
		$ali.html("");

		var $option = $("<option>[ Select action ]</option>")
		$aba.append($option);

		for (var n in actions) {
			var $option = $("<option value='"+n+"'>("+n+") "+actions[n].label+"</option>")
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


	})
});
