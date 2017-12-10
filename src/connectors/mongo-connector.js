const { MongoClient, Logger } = require('mongodb');

module.exports = async (entities, mongoUrl) => {
	const db = await MongoClient.connect(mongoUrl);

	let logCount = 0;
	Logger.setCurrentLogger((msg/*, state*/) => {
		console.log(`MONGODB REQUEST ${++logCount}: ${msg}`);
	});
	Logger.setLevel('debug');
	Logger.filter('class', ['Cursor', 'Db', 'Mongos']);

	const collectionsMap = entities.reduce((map, entity) => {
		const entityName = `${entity.name}s`;
		map[entityName] = db.collection(entityName.toLowerCase());
		return map;
	}, {});

	return collectionsMap;
};
