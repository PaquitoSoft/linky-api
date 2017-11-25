const { MongoClient, Logger } = require('mongodb');

// TODO Get form ENV
const MONGO_URL = 'mongodb://localhost:27017/linky-dev';

module.exports = async (entities, mongoUrl = MONGO_URL) => {
	const db = await MongoClient.connect(MONGO_URL);

	let logCount = 0;
	Logger.setCurrentLogger((msg, state) => {
		console.log(`MONGODB REQUEST ${++logCount}: ${msg}`);
	});
	Logger.setLevel('debug');
	Logger.filter('class', ['Cursor']);

	const collectionsMap = entities.reduce((map, entity) => {
		const entityName = `${entity.name}s`;
		map[entityName] = db.collection(entityName.toLowerCase());
		return map;
	}, {});

	return collectionsMap;

	// return {
	// 	Links: db.collection('links'),
	// 	Users: db.collection('users'),
	// 	Votes: db.collection('votes')
	// }
};
