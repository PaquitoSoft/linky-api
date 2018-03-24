const loaders = ['Users', 'Tags'];

class TypeLoader {

	constructor(mongoCollection, loaderName) {
		this.mongoCollection = mongoCollection;
		this.loaderName = loaderName;
		this.cache = {};
		this.queue = {};
	}

	load(key) {
		return new Promise((resolve, reject) => {
			if (!key) resolve(null);

			let result = this.cache[key];

			if (!result) {
				const pendingRead = this.queue[key];
				if (pendingRead) {
					return pendingRead.then(resolve);
				}
			}

			const readOperation = this.mongoCollection.findOne({ _id: key });
			this.queue[key] = readOperation;
			readOperation
				.then(type => {
					this.cache[key] = type;
					delete this.queue[key];
					resolve(type);
				})
				.catch(reject);

		});
	}

	loadMany(keys = []) {
		return new Promise((resolve, reject) => {
			if (!keys.length) return resolve([]);

			const values = keys.reduce((agg, key) => {
				if (this.cache[key]) {
					agg.cached.push(this.cache[key]);
				} else if (this.queue[key]) {
					agg.pending.push(this.queue[key]);
				} else {
					agg.newKeys.push(key);
				}
				return agg;
			}, { cached: [], pending: [], newKeys: [] });

			// Maybe all keys are already cached or pending
			let pendingRead;
			if (values.newKeys.length) {
				pendingRead = this.mongoCollection.find({ _id: { $in: values.newKeys }}).toArray();
				values.newKeys.forEach(key => {
					this.queue[key] = pendingRead;
				});

			} else {
				pendingRead = Promise.resolve([]);
			}

			Promise.all([
				pendingRead,
				...values.pending
			])
				.then(([ newValues, pendingValues = [] ]) => {
					newValues.forEach(newValue => this.cache[newValue._id] = newValue);
					pendingValues.forEach(pendingValue => delete this.queue[pendingValue._id]);
					resolve([...newValues, ...pendingValues, ...values.cached]);
				})
				.catch(reject);
		});
	}

	async _loadMany(keys = []) {
		if (!keys.length) {
			return [];
		}

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

module.exports = function (mongoCollections) {
	return loaders.reduce((loaders, loaderName) => {
		loaders[`${loaderName.toLocaleLowerCase()}Loader`] = new TypeLoader(mongoCollections[loaderName], loaderName);
		return loaders;
	}, {});
};
