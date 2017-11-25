const name = 'Vote';

const schemaDefinitions = {
	types: `
		type ${name} {
			id: ID!
			createdAt: Int!
			user: User!
			link: Link!
		}
	`
};

const resolvers = {
	type: {
		id: root => root._id || root.id
	}
};

module.exports = { name, schemaDefinitions, resolvers };
