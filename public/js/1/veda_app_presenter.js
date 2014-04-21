// Veda application Presenter

Veda.prototype.VedaPresenter = function VedaPresenter(hash) { "use strict";

	// Router function to call appropriate Presenter
	riot.route(function(hash) {
		var hash_tokens = hash.slice(2).split("/");
		var page = hash_tokens[0];
		var params = hash_tokens.slice(1);
		
		if (!getCookie("ticket")) { 
			var login_template = $("#login-template").html();
			$("#main").html(login_template);

			$("#login-form #submit").on("click", function(event) {
				event.preventDefault();
				app.authenticate( $("#login-form #login").val(), Sha256.hash( $("#login-form #password").val() ) );
				riot.route(hash);
			});
		} else {
			page == "console" 	? 	app.ConsolePresenter(params) : 
			page == "document"	? 	app.DocumentPresenter(params) :
			page == "search"	? 	app.SearchPresenter(params) : 
									app.ConsolePresenter(params); // Default Presenter
		}
	});

	// Listen to a link click and call router
	$("body").on("click", "[href^='#/']", function(e) {
		e.preventDefault();
		var link = $(this);
		return riot.route($(this).attr("href"));
	});

	// Listem to Model events
	veda.on("authenticate", function (ticket, end_time) {
		setCookie("ticket", ticket, {path: "/", expires: end_time});
	});
	veda.on("quit", function () {
		deleteCookie("ticket");
	});

	// Call router for current browser location hash
	riot.route(location.hash);
};