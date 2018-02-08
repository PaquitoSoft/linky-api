const jwt = require('jsonwebtoken');
const Boom = require('boom');
const { JWT_SECRET_KEY } = require('../config/app-config');

const authProviders = {
	'github': require('../auth-providers/github-provider')
};

const name = 'User';

const schemaDefinitions = {
	types: `
		type ${name} {
			id: ID!
			createdAt: DateTime!
			email: String!
			name: String!
			token: String
		}
	`,
	mutations: `
		login(providerType: String!, token: String!, hash: String): User
		logout(accessToken: String!): Boolean
	`
};

async function login(root, data, context) {
	const { mongo: { Users } } = context;
	const { providerType, token, hash } = data;

	const authProvider = authProviders[providerType];

	if (!authProvider) {
		throw Boom.badRequest('Invalid auth provider type');
	}

	// Check auth user in provider
	const { name, email } = await authProvider(token, hash);

	// Find user in database
	console.log('Looking for user:', email, name);
	let user = await Users.findOne({ email });
	console.log('User found:', user);

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
			id: mongoResponse.insertedIds[0]
		};
	}

	const userId = { uid: (user.id || user._id).toString() };
	user.token = jwt.sign(userId, JWT_SECRET_KEY);

	return user;
}

function logout(/*root, { accessToken }, context*/) {
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
