const DataLoader = require('dataloader');

const loaders = ['Users', 'Tags'];

async function batchLoader(mongoCollection, keys) {
	return await mongoCollection.find({ _id: { $in: keys }}).toArray();
}

module.exports = function (mongoCollections) {
	return loaders.reduce((loaders, loaderName) => {
		loaders[`${loaderName.toLocaleLowerCase()}Loader`] = new DataLoader(
			keys => batchLoader(mongoCollections[loaderName], keys),
			{ cacheKeyFn: key => key.toString() }
		);
		return loaders;
	}, {});
};
