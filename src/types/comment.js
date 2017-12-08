const name = 'FakeComment';

const schemaDefinitions = {
	types: `
		type ${name} {
			id: ID!
			createdAt: Int!
			text: String!
			user: User!
		}
	`
};

const resolvers = {
	type: {
		id: root => root._id || root.id
	}
};

module.exports = { name, schemaDefinitions, resolvers };
