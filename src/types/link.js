const Boom = require('boom');
const { ObjectID } = require('mongodb');
const name = 'Link';

const schemaDefinitions = {
	types: `
		type ${name} {
			id: ID!
			url: String!
			createdAt: DateTime!
			owner: User!
			votes: [User!]
			comments: [Comment!]
			tags: [Tag!]
		}

		type Comment {
			id: ID!
			user: User!
			createdAt: DateTime!
			text: String!
		}

		input NewLink {
			url: String!
			comment: String
			tags: [String!]
		}

		input EditLink {
			id: ID!
			url: String
			tags: [String!]
		}
	`,
	queries: `
		getLinks(first: Int, count: Int): [Link!]!
	`,
	mutations: `
		createLink(link: NewLink!): Link!
		editLink(link: EditLink!): Link!
		removeLink(linkId: String!): Boolean
	`
};

async function processTags(tagsNames, TagsMongoCollection) {
	const tags = [];

	for (let tagName of tagsNames) {
		let tag = await TagsMongoCollection.findOne({ lowercaseName: tagName.toLowerCase() });

		if (!tag) {
			// TODO: Create the tags in this module doesn't feel right
			tag = {
				name: tagName,
				lowercaseName: tagName.toLowerCase(),
				createdAt: Date.now()
			};

			const mongoResponse = await TagsMongoCollection.insert(tag);
			tag._id = mongoResponse.insertedIds[0];
		}
		tags.push(tag);
	}
	return tags;
}

async function createLink(root, params, context) {
	const { user, mongo: { Links, Tags } } = context;

	const { link } = params;

	const alreadyExistingLink = await Links.findOne({ url: link.url });
	if (alreadyExistingLink) {
		throw Boom.conflict('Link already exists');
	}

	const newLink = {
		url: link.url,
		createdAt: Date.now(),
		owner: user._id,
		votes: [],
		comments: [],
		tags: []
	};

	if (link.comment) {
		newLink.comments.push({
			id: ObjectID(),
			user: user._id,
			createdAt: Date.now(),
			text: link.comment
		});
	}

	if (link.tags) {
		const tags = await processTags(link.tags, Tags);
		newLink.tags = tags.map(tag => tag._id);
	}

	const mongoResponse = await Links.insert(newLink);

	return {
		...newLink,
		id: mongoResponse.insertedIds[0]
	};
}

async function editLink(root, params, context) {
	const { user, mongo: { Links, Tags } } = context;

	const { link } = params;

	const editedLink = await Links.findOne({ _id: ObjectID(link.id) });
	if (!editedLink) {
		throw Boom.notFound('Link to be edited not found');
	}

	if (user._id.toString() !== editedLink.owner.toString()) {
		throw Boom.unauthorized('Only link owner can edit it');
	}

	if (link.url !== editedLink.url) {
		const alreadyExistingLink = await Links.findOne({ url: link.url });
		if (alreadyExistingLink) {
			throw Boom.conflict('New link URL already existis', { linkId: alreadyExistingLink._id });
		}
	}

	editedLink.url = link.url || editedLink.url;
	if (link.tags) {
		const tags = await processTags(link.tags, Tags);
		editedLink.tags = tags.map(tag => tag._id);
	}

	await Links.updateOne(
		{ _id: ObjectID(editedLink._id) },
		{ $set: { url: editedLink.url, tags: editedLink.tags } }
	);

	return editedLink;
}

async function removeLink(root, params, context) {
	return true;
}

async function getLinks(root, params, context) {
	const { mongo: { Links } } = context;
	let { first = 0, count = 20 } = params;
	if (count > 50) count = 50; // Do not allow a client to ask for all the links

	return await Links
		.find({})
		.skip(first)
		.limit(count)
		.sort(['createdAt', 1])
		.toArray();
}

const resolvers = {
	type: {
		id: root => root._id || root.id,
		owner: async (root, args, context) => {
			const { mongo: { Users }} = context;
			return await Users.findOne({_id: root.owner });
		},
		votes: async (root, args, context) => {
			if (root.votes.length) {
				const { mongo: { Users }} = context;
				const usersIds = root.votes.map(ObjectID);
				return await Users.find({ _id: { $in: usersIds }});
			}
			return [];
		},
		comments: async (root, args, context) => {
			const { mongo: { Users }} = context;
			for (let comment of root.comments) {
				comment.user = await Users.findOne({ _id: ObjectID(comment.user.id) });
			}
			return root.comments;
		},
		tags: async (root, args, context) => {
			if (root.tags.length) {
				const { mongo: { Tags }} = context;
				const tagsIds = root.tags.map(ObjectID);
				return await Tags.find({ _id: { $in: tagsIds }}).toArray();
			}
			return [];
		}
	},
	queries: { getLinks },
	mutations: {
		createLink,
		editLink,
		removeLink
	}
};

module.exports = { name, schemaDefinitions, resolvers };
