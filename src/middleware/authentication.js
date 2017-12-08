const jwt = require('jsonwebtoken');
const Boom = require('boom');
const { ObjectID } = require('mongodb');
const { JWT_SECRET_KEY } = require('../config/app-config');

module.exports = function authMiddleware(root, data, context, operation) {
	// console.log('---------- Runnning auth middleware for operation:', operation.fieldName);
	// console.log('------ Auth token:', context.authToken);

	return new Promise((resolve, reject) => {
		if (operation.fieldName !== 'login') {
			const decoded = jwt.verify(context.authToken, JWT_SECRET_KEY);

			context.mongo.Users.findOne({ _id: (decoded && decoded.uid) ? new ObjectID(decoded.uid) : null }, (err, user) => {
				if (err) return reject(err);
				if (!user) return reject(Boom.unauthorized('Request requires an authenticated user'));

				context.loggedUser = user;
				resolve(user);
			});
		} else {
			resolve({});
		}
	});
};