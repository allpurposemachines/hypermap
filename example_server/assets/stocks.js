setInterval(() => {
	hypermap.at('market').innerMap.forEach(stock => {
		const prevPrice = parseFloat(stock.at('price').value);
		const newPrice = prevPrice + (Math.random() * 10) - 5;
		stock.set('price', new HypermapShim.ValueNode(newPrice.toFixed(2)));
	});
}, 2000);
