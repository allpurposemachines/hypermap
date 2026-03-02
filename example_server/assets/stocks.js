setInterval(() => {
	hypermap.at('market').innerMap.forEach(stock => {
		const prevPrice = parseFloat(stock.at('price').value);
		const delta = (Math.random() * 10) - 5;
		const newPrice = Math.max(0.01, prevPrice + delta);
		stock.set('price', new HypermapShim.ValueNode(newPrice.toFixed(2)));

		const pct = ((delta / prevPrice) * 100).toFixed(2);
		const sign = pct >= 0 ? '+' : '';
		stock.set('change', new HypermapShim.ValueNode(sign + pct + '%'));
	});
}, 2000);
