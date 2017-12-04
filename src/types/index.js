const { readdirSync } = require('fs');
const jwt = require('jsonwebtoken');
const { makeExecutableSchema } = require('graphql-tools');
const { ObjectID } = require('mongodb');
const Boom = require('boom');
const { JWT_SECRET_KEY } = require('../config/app-config');

const typeFiles = readdirSync(__dirname);
const TYPES = typeFiles
	.filter(path => path !== 'index.js')
	.map(fileRelativePath => require(`./${fileRelativePath}`));


function authMiddleware(root, data, context, operation) {
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


}

function resolverWithMiddlewares(resolver, middlewares = []) {
	return async (root, data, context, operation) => {
		for (let middleware of middlewares) {
			await middleware(root, data, context, operation);
		}
		return resolver(root, data, context, operation);
	};
}

function resolversWithMiddleware(resolvers, middlewares = []) {
	return Object.keys(resolvers)
		.reduce((wrappedResolvers, key) => {
			wrappedResolvers[key] = resolverWithMiddlewares(resolvers[key], middlewares);
			return wrappedResolvers;
		}, {});
}

function buildTypeDefinitions(schemaDefinitions) {
	return `
		${schemaDefinitions.types.join('\n')}
		type Query {
			${schemaDefinitions.queries.join('\n')}
		}
		${
			schemaDefinitions.mutations.length ?
			'type Mutation {\n' + schemaDefinitions.mutations.join('\n') + '\n}' :
			''
		}
	`;
}

function buildResolvers(resolvers) {
	const result = {
		...resolvers.types,
		Query: {
			...resolvers.queries
		}
	};

	if (Object.keys(resolvers.mutations).length) {
		result.Mutation = {
			...resolvers.mutations
		};
	}

	return result;
}

module.exports.getTypes = () => TYPES;

module.exports.createSchema = function createSchema() {
	const baseMap = {
		schemaDefinitions: {
			types: [],
			queries: [],
			mutations: []
		},
		resolvers: {
			types: {},
			queries: {},
			mutations: {}
		}
	};

	const typesMap = TYPES.reduce((map, type) => {
		// console.log('Processing type:', type.name);

		const { schemaDefinitions: { types, queries, mutations }, resolvers } = type;
		const middlewares = [authMiddleware];

		// Extract schema definitions
		map.schemaDefinitions.types.push(types);
		if (queries) {
			map.schemaDefinitions.queries.push(queries);
		}
		if (mutations) {
			map.schemaDefinitions.mutations.push(mutations);
		}

		// Extract types resolvers
		map.resolvers.types[type.name] = resolvers.type;
		if (resolvers.queries) {
			map.resolvers.queries = {
				...map.resolvers.queries,
				...resolversWithMiddleware(resolvers.queries, middlewares)
			};
		}
		if (resolvers.mutations) {
			map.resolvers.mutations = {
				...map.resolvers.mutations,
				...resolversWithMiddleware(resolvers.mutations, middlewares)
			};
		}

		return map;
	}, baseMap);

	return makeExecutableSchema({
		typeDefs: buildTypeDefinitions(typesMap.schemaDefinitions),
		resolvers: buildResolvers(typesMap.resolvers)
	});
};
