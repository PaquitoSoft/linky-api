const name = 'Tag';

const schemaDefinitions = {
	types: `
		type ${name} {
			id: ID!
			createdAt: DateTime!
			name: String!
		}
	`,
	queries: `
		searchTags(filter: String!): [Tag!]
	`
};

async function searchTags(root, params, context) {
	const { mongo: { Tags } } = context;
	const { filter } = params;
	const regex = new RegExp(`^${filter}`, 'i');

	// TODO Maybe I should store tags names also in lowercase to
	// aid in this query performance
	return await Tags
		.find({ name: { $regex: regex } })
		.limit(10)
		.toArray();
}

const resolvers = {
	type: {
		id: root => root._id || root.id
	},
	queries: {
		searchTags
	}
};

module.exports = { name, schemaDefinitions, resolvers };
