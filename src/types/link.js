const name = 'Link';

const schemaDefinitions = {
	types: `
		type ${name} {
			id: ID!
			url: String!
			createdAt: Int!
			owner: User!
			votes: [User!]!
			comments: [Comment!]!
			tags: [Tag!]!
		}
	`,
	queries: `
		getLinks(first: Int, count: Int): [Link!]!
	`
	// mutations: ''
};

async function getLinks(root, params, context) {
	const { mongo: { Links } } = context;
	let { first = 0, count = 20 } = params;
	if (count > 50) count = 20; // Do not allow a client to ask for all the links

	console.log('getLinks# ', context.loggedUser);
	// throw new Error('Toma petada!');

	return await Links
		.find({})
		.skip(first)
		.limit(count)
		.sort(['createdAt', 1])
		.toArray();
}

const resolvers = {
	type: {
		id: root => root._id || root.id
	},
	queries: { getLinks },
	mutations: {}
};

module.exports = { name, schemaDefinitions, resolvers };
