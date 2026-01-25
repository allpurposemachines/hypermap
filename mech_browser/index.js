class Tab extends EventTarget {
	constructor(contentWindow, url) {
		super();
		this.window = contentWindow;
		this.hypermap = null;
		this.url = url; // FIXME: update when the location changes
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

globalThis.Mech = {
	tabs: [],
	tabMap: new Map(),
	iframeMap: new Map(),

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

		const tab = new Tab(iframe.contentWindow, url);
		this.tabs.push(tab);
		this.tabMap.set(iframe.contentWindow, tab);
		this.iframeMap.set(tab, iframe);

		return tab;
	},

	closeTab: function(tab) {
		const index = this.tabs.indexOf(tab);
		if (index === -1) return;
		
		const iframe = this.iframeMap.get(tab);
		if (iframe && iframe.parentNode) {
			iframe.parentNode.removeChild(iframe);
		}

		this.tabMap.delete(tab.window);
		this.iframeMap.delete(tab);

		this.tabs.splice(index, 1);
	}
}

window.addEventListener('message', (event) => {
	const data = JSON.parse(event.data);
	let tab = Mech.tabMap.get(event.source);
	if (tab) {
		tab.hypermap = data.data;
		tab.dispatchEvent(new Event('changed'));
	}
});
