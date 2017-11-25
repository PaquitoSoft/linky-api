const { makeExecutableSchema } = require('graphql-tools');
const resolvers = require('./resolvers');

const typeDefs = `
	type Link {
		id: ID!
		url: String!
		createdAt: Date!
		user: User!
		votes: [Vote!]!
		comments: [Comment!]!
		tags: [Tag!]!
	}

	type User {
		id: ID!
		email: String!
		name: String!
	}

	type Vote {
		id: ID!
		user: User!
		link: Link!
	}

	type Comment {
		id: ID!
		text: String!
		createdAt: Date!
		user: User!
	}

	type Tag {
		id: ID!
		name: String!
	}
`;
