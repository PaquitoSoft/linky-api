module.exports = {
	MONGO_URL: process.env.LINKY_MONGO_URL ||
	'mongodb://linky-dev:ved-yknil@linky-dev-shard-00-00-eysch.mongodb.net:27017,linky-dev-shard-00-01-eysch.mongodb.net:27017,linky-dev-shard-00-02-eysch.mongodb.net:27017/test?ssl=true&replicaSet=linky-dev-shard-0&authSource=admin' ||
	'mongodb://localhost:27017/linky-dev'
};
