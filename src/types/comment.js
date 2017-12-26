const name = 'Comment';

const schemaDefinitions = {
	types: `
		type ${name} {
			id: ID!
			user: User!
			createdAt: DateTime!
			text: String!
		}
	`
};

const resolvers = {
	type: {
		id: root => (root._id || root.id),
		user: (root, args, context) => {
			const { dataLoaders: { usersLoader } } = context;
			// When creating a new comment, the user attribute is only an ID
			if (root.user._id) {
				return Promise.resolve(root.user);
			} else {
				return usersLoader.load(root.user);
			}
		}
	}
};

module.exports = { name, schemaDefinitions, resolvers };
