setInterval(() => {
	hypermap.at('market').innerMap.forEach(stock => {
		const prevPrice = stock.at('price').value;
		const newPrice = prevPrice + (Math.random() * 10) - 5;
		stock.set('price', new HypermapShim.NumberNode(newPrice));
	});
}, 2000);
