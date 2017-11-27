const name = 'User';

const schemaDefinitions = {
	types: `
		type ${name} {
			id: ID!
			createdAt: DateTime!
			email: String!
			name: String!
		}
	`,
	mutations: `
		login(providerType: String!, token: String!): User
		logout(accessToken: String!): Boolean
	`
};

async function login(root, data, context) {
	const { mongo: { Users } } = context;
	const { providerType, token } = data;

	// TODO Check auth user in provider
	const email = 'paquitosoftware@gmail.com';
	const name = 'PaquitoSoft';

	// Find user in database
	let user = await Users.findOne({ email });

	// Create the user if it does not already exists
	if (!user) {
		const newUser = {
			email,
			name,
			createdAt: Date.now()
		};
		const mongoResponse = await Users.insert(newUser);
		user = {
			...newUser,
			if: mongoResponse.insertedIds[0]
		}
	}

	return user;
}

function logout(root, { accessToken }, context) {
	// TODO
	return true;
}

const resolvers = {
	type: {
		id: root => root._id || root.id
	},
	mutations: { login, logout }
};

module.exports = { name, schemaDefinitions, resolvers };
