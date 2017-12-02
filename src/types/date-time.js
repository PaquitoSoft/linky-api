const { GraphQLScalarType } = require('graphql');
const { Kind } = require('graphql/language');

const name = 'DateTime';

const schemaDefinitions = {
	types: `
		scalar ${name}
	`
};

const resolvers = {
	type: new GraphQLScalarType({
		name,
		description: 'Date scalar type',
		parseValue(value) {
			return new Date(value); // value from the client
		},
		serialize(value) {
			// return value.getTime(); // value sent to client
			return new Date(value);
		},
		parseLiteral(ast) {
			if (ast.kind === Kind.INT) {
				return parseInt(ast.value, 10); // ast value is always in string format
			}
			return null;
		}
	})
};

module.exports = { name, schemaDefinitions, resolvers };
