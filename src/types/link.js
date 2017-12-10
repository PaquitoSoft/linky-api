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

		input LinkQueryOrderOption {
			field: String!
			isDescending: Boolean!
		}

		input LinkQueryFilterOption {
			field: String!
			values: [String!]
		}

		input LinkQueryCriteria {
			first: Int
			count: Int
			filter: [LinkQueryFilterOption]
			order: [LinkQueryOrderOption]
		}
	`,
	queries: `
		searchLinks(criteria: LinkQueryCriteria): [Link!]!
	`,
	mutations: `
		createLink(link: NewLink!): Link!
		editLink(link: EditLink!): Link!
		removeLink(linkId: ID!): Boolean
	`
};

const ORDER_ALLOWED_FIELDS = ['createdAt', 'votes'];

function validateLinkMutation(link, { user: currentUser }) {
	if (!link) {
		throw Boom.notFound('Link to be edited not found');
	}

	if (currentUser._id.toString() !== link.owner.toString()) {
		throw Boom.unauthorized('Only link owner can edit it');
	}
}

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
	const { mongo: { Links, Tags } } = context;
	const { link } = params;
	const linkId = ObjectID(link.id);

	const editedLink = await Links.findOne({ _id: linkId });

	validateLinkMutation(editedLink, context);

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
	const { mongo: { Links } } = context;

	const linkId = ObjectID(params.linkId);
	const alreadyExistingLink = await Links.findOne({ _id: linkId });

	validateLinkMutation(alreadyExistingLink, context);

	const mongoResponse = await Links.deleteOne({ _id: linkId });

	return mongoResponse.deletedCount > 0;
}

async function searchLinks(root, params, context) {
	const { mongo: { Links } } = context;
	const { criteria: { first = 0, filter, order } } = params;
	let count = params.count || 20;
	if (count > 50) count = 50; // Do not allow a client to ask for all the links

	const filterCriteria = (filter || []).reduce((aggregated, filterOption) => {
		switch (filterOption.field) {
			case 'owner':
				aggregated[filterOption.field] = ObjectID(filterOption.values[0]);
				break;
			case 'tags':
				aggregated[filterOption.field] = {
					$in: filterOption.values.map(ObjectID)
				};
		}
		return aggregated;
	}, {});

	let orderCriteria = !order || !order.length ?
		[{ field: 'createdAt', isDescending: true }] : order;

	orderCriteria = orderCriteria
		.filter(orderOption => {
			return ORDER_ALLOWED_FIELDS.includes(orderOption.field);
		})
		.map(orderOption => {
			return [orderOption.field, orderOption.isDescending ? -1 : 1];
		});

	return await Links
		.find(filterCriteria)
		.skip(first)
		.limit(count)
		.sort(orderCriteria)
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
	queries: { searchLinks },
	mutations: {
		createLink,
		editLink,
		removeLink
	}
};

module.exports = { name, schemaDefinitions, resolvers };
