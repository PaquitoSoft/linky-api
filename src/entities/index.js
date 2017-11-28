const { makeExecutableSchema } = require('graphql-tools');

const link = require('./link');
const user = require('./user');
const comment = require('./comment');
// const vote = require('./vote');
const tag = require('./tag');
const dateTime = require('./date-time');

// TODO Read modules from disk so we autopopulate this array
const ENTITIES = [link, user, comment, /*vote,*/ tag, dateTime];

function authMiddleware(root, data, context, operation) {
	if (operation.fieldName !== 'login') {
		// TODO Check authorization
		// TODO Use Boom package (https://github.com/hapijs/boom) to raise errors
		// Boom.unauthorized('Request requires an authenticated user');
	}
}

function resolversWithMiddleware(resolvers, middlewares = []) {
	return resolvers.map(resolver => {
		return (root, data, context, operation) => {
			// TODO This only allows sync middlewares and errors must be thrown
			middlewares.forEach(fn.bind(null, root, data, context, operation));
			return resolver(root, data, context, operation);
		}
	});
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

module.exports.getEntities = () => ENTITIES;

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

	const entitiesMap = ENTITIES.reduce((map, entity) => {
		const { schemaDefinitions: { types, queries, mutations }, resolvers } = entity;

		// Extract schema definitions
		map.schemaDefinitions.types.push(types);
		if (queries) {
			map.schemaDefinitions.queries.push(queries);
		}
		if (mutations) {
			map.schemaDefinitions.mutations.push(mutations);
		}

		// Extract types resolvers
		map.resolvers.types[entity.name] = resolvers.type;
		if (resolvers.queries) {
			map.resolvers.queries = {
				...map.resolvers.queries,
				...resolvers.queries
			};
		}
		if (resolvers.mutations) {
			map.resolvers.mutations = {
				...map.resolvers.mutations,
				...resolvers.mutations
			};
		}

		return map;
	}, baseMap);

	return makeExecutableSchema({
		typeDefs: buildTypeDefinitions(entitiesMap.schemaDefinitions),
		resolvers: buildResolvers(entitiesMap.resolvers)
	});
};
