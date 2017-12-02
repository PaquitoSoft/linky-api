const { readdirSync } = require('fs');
const { makeExecutableSchema } = require('graphql-tools');

const typeFiles = readdirSync(__dirname);
const TYPES = typeFiles
	.filter(path => path !== 'index.js')
	.map(fileRelativePath => require(`./${fileRelativePath}`));


function authMiddleware(root, data, context, operation) {
	console.log('---------- Runnning auth middleware for operation:', operation.fieldName);
	if (operation.fieldName !== 'login') {
		// TODO Check authorization
		// TODO Use Boom package (https://github.com/hapijs/boom) to raise errors
		// Boom.unauthorized('Request requires an authenticated user');
	}
}

function resolverWithMiddleware(resolver, middlewares = []) {
	return (root, data, context, operation) => {
		console.log('Executing wrapped resolver for operation:', operation.fieldName, middlewares);
		// TODO This only allows sync middlewares and errors must be thrown
		middlewares.forEach(middleware => middleware(root, data, context, operation));
		return resolver(root, data, context, operation);
	}
}

function resolversWithMiddleware(resolvers, middlewares = []) {
	return Object.keys(resolvers)
		.reduce((wrappedResolvers, key) => {
			wrappedResolvers[key] = resolverWithMiddleware(resolvers[key], middlewares);
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
	}

	if (Object.keys(resolvers.mutations).length) {
		result.Mutation = {
			...resolvers.mutations
		}
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
		console.log('Processing type:', type.name);

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
