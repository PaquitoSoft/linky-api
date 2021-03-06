const { URL } = require('url');
const Boom = require('boom');
const { ObjectID } = require('mongodb');
const request = require('request-promise-native');
const { JSDOM } = require('jsdom');

const name = 'Link';

const schemaDefinitions = {
	types: `
		type ${name} {
			id: ID!
			url: String!
			title: String
			description: String
			imageUrl: String
			createdAt: DateTime!
			owner: User!
			votes: [User!]
			comments: [Comment!]
			tags: [Tag!]
		}

		input NewLink {
			url: String!
			comment: String
			tags: [LinkTag]
		}

		input LinkTag {
			id: ID,
			name: String!
		}

		input EditLink {
			id: ID!
			url: String
			tags: [ID!]
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
		addLinkComment(linkId: ID!, comment: String!): Comment
		removeLinkComment(linkId: ID!, commentId: ID!): Boolean
		addLinkVote(linkId: ID!): User
	`
};

const ORDER_ALLOWED_FIELDS = ['createdAt', 'votes'];

async function getLinkMetaData(linkUrl) {
	// TODO Handle request error
	const html = await request(linkUrl);
	const { window: { document } } = new JSDOM(html);

	const titleTag = document.querySelector('title');
	const titleMeta = document.querySelector('meta[property="og:title"]');
	const descriptionMeta = document.querySelector('meta[property="og:description"]');
	const imageMeta = document.querySelector('meta[property="og:image"]');

	// Deal with images with relative URLs
	let imageUrl = imageMeta ? imageMeta.getAttribute('content') : '';
	if (imageUrl.startsWith('/')) {
		const url = new URL(linkUrl);
		imageUrl = `${url.origin}${imageUrl}`;
	}

	return {
		title: titleMeta ? titleMeta.getAttribute('content') : titleTag ? titleTag.text.trim() : '',
		description: descriptionMeta ? descriptionMeta.getAttribute('content') : '',
		imageUrl
	};
}

function validateLinkMutation(link, { user: currentUser }) {
	if (!link) {
		throw Boom.notFound('Link to be edited not found');
	}

	if (currentUser._id.toString() !== link.owner.toString()) {
		throw Boom.unauthorized('Only link owner can edit it');
	}
}

async function processTags(tags, TagsMongoCollection) {
	const _tags = [];

	for (let tag of tags) {
		if (!tag.id) {
			// TODO: Create the tags in this module doesn't feel right
			// I also need to check that new tags (the ones with no ID)
			// does not exist yet
			tag = {
				name: tag.name,
				lowercaseName: tag.name.toLowerCase(),
				createdAt: Date.now()
			};

			const mongoResponse = await TagsMongoCollection.insert(tag);
			tag._id = mongoResponse.insertedIds[0];
		} else {
			tag._id = ObjectID(tag.id);
		}
		_tags.push(tag);
	}
	return _tags;
}

async function createLink(root, params, context) {
	const { user, mongo: { Links, Tags } } = context;

	const { link } = params;

	// TODO Validate url input is actually a URL

	const alreadyExistingLink = await Links.findOne({ url: link.url });
	if (alreadyExistingLink) {
		throw Boom.conflict('Link already exists');
	}

	const linkMetaData = await getLinkMetaData(link.url);

	const newLink = {
		url: link.url,
		createdAt: Date.now(),
		owner: user._id,
		votes: [],
		comments: [],
		tags: [],
		...linkMetaData
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
	let count = params.criteria.count || 20;
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

async function addLinkComment(root, params, context) {
	const { mongo: { Links }, user } = context;
	const { linkId, comment } = params;

	const newComment = {
		id: ObjectID(),
		user: user._id,
		createdAt: Date.now(),
		text: comment
	};

	await Links.update(
		{ _id: ObjectID(linkId) },
		{ $push: { comments: newComment } }
	);

	return newComment;
}

async function removeLinkComment(root, params, context) {
	const { mongo: { Links }, user } = context;
	const { linkId, commentId } = params;

	const link = await Links.findOne({ _id: ObjectID(linkId) });

	if (!link) {
		throw Boom.notFound('Comment parent link not found');
	}

	const commentIndex = (link.comments || []).findIndex(comment => comment.id.toString() === commentId);

	if (commentIndex === -1) {
		throw Boom.notFound('Comment to be removed not found');
	}

	const commentToBeRemoved = link.comments[commentIndex];

	if (commentToBeRemoved.user.toString() !== user._id.toString()) {
		throw Boom.unauthorized('Only comment owner can remove it');
	}

	await Links.update(
		{ _id: ObjectID(linkId) },
		{ $pull: { comments: { id: ObjectID(commentId) } } }
	);

	// TODO Check that the comment has been actually removed

	return true;
}

async function addLinkVote(root, params, context) {
	const { mongo: { Links }, user } = context;
	const { linkId } = params;

	const link = await Links.findOne({ _id: ObjectID(linkId) });

	if (!link) {
		throw Boom.notFound('Link to be voted not found');
	}

	if (user._id.toString() === link.owner.toString()) {
		throw Boom.preconditionFailed('Owner cannot vote for one of his links');
	}

	if (link.votes.find(userId => userId.toString() === user._id.toString())) {
		throw Boom.preconditionFailed('User already voted for this link');
	}

	await Links.update(
		{ _id: ObjectID(linkId) },
		{ $push: { votes: user._id } }
	);

	return user;
}

const resolvers = {
	type: {
		id: root => root._id || root.id,
		owner: async (root, args, context) => {
			const { dataLoaders: { usersLoader } } = context;
			return await usersLoader.load(root.owner);
		},
		votes: async (root, args, context) => {
			const { dataLoaders: { usersLoader } } = context;
			return await usersLoader.loadMany(root.votes);
		},
		comments: async (root, args, context) => {
			const { dataLoaders: { usersLoader } } = context;

			for (let comment of root.comments) {
				comment.user = await usersLoader.load(comment.user);
			}

			return root.comments;
		},
		tags: async (root, args, context) => {
			const { dataLoaders: { tagsLoader } } = context;
			return await tagsLoader.loadMany(root.tags);
		}
	},
	queries: { searchLinks },
	mutations: {
		createLink,
		editLink,
		removeLink,
		addLinkComment,
		removeLinkComment,
		addLinkVote
	}
};

module.exports = { name, schemaDefinitions, resolvers };
