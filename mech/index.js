class Tab {
	constructor(contentWindow) {
		this.window = contentWindow;
		this.hypermap = null;
	}

	use(path) {
		const message = { type: "use", path };
		this.window.postMessage(JSON.stringify(message), '*');
	}

	input(path, value) {
		const message = { type: "input", path, value };
		this.window.postMessage(JSON.stringify(message), '*');
	}
}

const Mech = {
	tabs: [],
	tabMap: new Map(),
	open: function(url) {
		const iframe = document.createElement('iframe');
		iframe.src = url;
		iframe.style.position = 'absolute';
		iframe.style.width = '0';
		iframe.style.height = '0';
		iframe.style.opacity = '0';
		iframe.style.pointerEvents = 'none';
		iframe.style.border = 'none';
		document.body.appendChild(iframe);

		const tab = new Tab(iframe.contentWindow);
		this.tabs.push(tab);
		this.tabMap.set(iframe.contentWindow, tab);

		return tab;
	}
}

window.addEventListener('message', (event) => {
	const data = JSON.parse(event.data);
	let tab = Mech.tabMap.get(event.source);
	if (tab) {
		tab.hypermap = data.data;
	}
});
