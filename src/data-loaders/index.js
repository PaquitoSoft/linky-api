// const DataLoader = require('dataloader');

const loaders = ['Users', 'Tags'];

class TypeLoader {

	constructor(mongoCollection) {
		this.mongoCollection = mongoCollection;
		this.cache = {};
	}

	async load(key) {
		let result = this.cache[key];

		if (!result) {
			result = await this.mongoCollection.findOne({ _id: key });
		}

		return result;
	}

	async loadMany(keys) {
		const values = keys.reduce((agg, key) => {
			if (this.cache[key]) {
				agg.cached.push(this.cache[key]);
			} else {
				agg.newKeys.push(key);
			}
			return agg;
		}, { cached: [], newKeys: [] });

		const newResults = await this.mongoCollection.find({ _id: { $in: values.newKeys }}).toArray();

		newResults.forEach(result => {
			this.cache[result._id] = result;
		});

		return values.cached.concat(newResults);
	}

}


// async function batchLoader(mongoCollection, keys) {
// 	console.log('Loading batched keys:', keys.map(key => key.toString()));
// 	return await mongoCollection.find({ _id: { $in: keys }}).toArray();
// }

module.exports = function (mongoCollections) {
	// return loaders.reduce((loaders, loaderName) => {
	// 	loaders[`${loaderName.toLocaleLowerCase()}Loader`] = new DataLoader(
	// 		async (keys) => batchLoader(mongoCollections[loaderName], keys),
	// 		{ cacheKeyFn: key => key.toString() }
	// 	);
	// 	return loaders;
	// }, {});

	return loaders.reduce((loaders, loaderName) => {
		loaders[`${loaderName.toLocaleLowerCase()}Loader`] = new TypeLoader(mongoCollections[loaderName]);
		return loaders;
	}, {});
};
