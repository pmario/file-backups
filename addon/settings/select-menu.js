/*
 * settings/select-menu.js — a select look-alike for the options page.
 *
 * Firefox draws the list of a native <select> outside the page, and inside
 * the about:addons options panel it can open in the wrong place (seen with
 * a zoomed Firefox). This replaces the visible control with a button and an
 * in-page list positioned right below it. The native <select> stays in the
 * page (hidden) and holds the value, so form code keeps reading and writing
 * select.value; after a programmatic change call select.fbRefresh().
 *
 * Keyboard: Enter / Space / ArrowDown open the list; ArrowUp / ArrowDown /
 * Home / End move; Enter / Space choose; Escape / Tab close.
 */

function enhanceSelect(select) {
	"use strict";

	var wrap = document.createElement("span");
	wrap.className = "fb-select";

	var button = document.createElement("button");
	button.type = "button";
	button.className = "fb-select-button";
	button.id = select.id + "-button";
	button.setAttribute("aria-haspopup", "listbox");
	button.setAttribute("aria-expanded", "false");

	var list = document.createElement("ul");
	list.className = "fb-select-list";
	list.id = select.id + "-list";
	list.setAttribute("role", "listbox");
	list.hidden = true;
	button.setAttribute("aria-controls", list.id);

	var items = [];
	Array.prototype.forEach.call(select.options, function (opt) {
		var li = document.createElement("li");
		li.setAttribute("role", "option");
		li.tabIndex = -1;
		li.dataset.value = opt.value;
		li.textContent = opt.textContent;
		list.appendChild(li);
		items.push(li);
	});

	// Labels that pointed at the hidden select now point at the button.
	Array.prototype.forEach.call(document.querySelectorAll('label[for="' + select.id + '"]'), function (label) {
		label.htmlFor = button.id;
	});

	select.hidden = true;
	select.setAttribute("aria-hidden", "true");
	select.tabIndex = -1;
	select.parentNode.insertBefore(wrap, select);
	wrap.appendChild(button);
	wrap.appendChild(list);
	wrap.appendChild(select);

	function selectedIndex() {
		for (var i = 0; i < items.length; i++) {
			if (items[i].dataset.value === select.value) return i;
		}
		return 0;
	}

	function refresh() {
		var idx = selectedIndex();
		items.forEach(function (li, i) {
			li.setAttribute("aria-selected", i === idx ? "true" : "false");
		});
		button.textContent = items.length ? items[idx].textContent : "";
	}

	function isOpen() {
		return !list.hidden;
	}

	function open() {
		list.hidden = false;
		button.setAttribute("aria-expanded", "true");
		items[selectedIndex()].focus();
	}

	function close(focusButton) {
		if (!isOpen()) return;
		list.hidden = true;
		button.setAttribute("aria-expanded", "false");
		if (focusButton) button.focus();
	}

	function choose(li) {
		var changed = select.value !== li.dataset.value;
		select.value = li.dataset.value;
		refresh();
		close(true);
		if (changed) select.dispatchEvent(new Event("change", {bubbles: true}));
	}

	button.addEventListener("click", function () {
		if (isOpen()) close(true); else open();
	});

	button.addEventListener("keydown", function (e) {
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			open();
		}
	});

	list.addEventListener("click", function (e) {
		var li = e.target.closest("li[role=option]");
		if (li) choose(li);
	});

	list.addEventListener("keydown", function (e) {
		var i = items.indexOf(document.activeElement);
		if (e.key === "ArrowDown") {
			e.preventDefault();
			items[Math.min(i + 1, items.length - 1)].focus();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			items[Math.max(i - 1, 0)].focus();
		} else if (e.key === "Home") {
			e.preventDefault();
			items[0].focus();
		} else if (e.key === "End") {
			e.preventDefault();
			items[items.length - 1].focus();
		} else if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			if (i !== -1) choose(items[i]);
		} else if (e.key === "Escape") {
			e.preventDefault();
			close(true);
		} else if (e.key === "Tab") {
			close(false);
		}
	});

	document.addEventListener("mousedown", function (e) {
		if (isOpen() && !wrap.contains(e.target)) close(false);
	});

	select.fbRefresh = refresh;
	refresh();
}
