const name = 'User';

const schemaDefinitions = {
	types: `
		type ${name} {
			id: ID!
			createdAt: Int!
			email: String!
			name: String!
		}
	`
};

const resolvers = {
	type: {
		id: root => root._id || root.id
	}
};

module.exports = { name, schemaDefinitions, resolvers };
