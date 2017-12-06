const authMiddleware = require('./authentication');

module.exports.getMiddlewares = function() {
	return [authMiddleware];
};
