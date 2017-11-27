const express = require('express');
const bodyParser = require('body-parser');

// This package will handle GraphQL server requests and responses
// based on the provided schema definition
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');

const connectToMongo = require('./connectors/mongo-connector');
// const { authenticate } = require('./authentication');
// const buildDataLoaders = require('./data-loaders/data-loaders');
// const formatError = require('./format-error');

const SERVER_PORT = process.env.LINKY_API_SERVER_PORT || 3003;

const { getEntities, createSchema } = require('./entities/');

async function start() {
	const mongo = await connectToMongo(getEntities());
	const app = express();
	const schema = createSchema();

	// Route all GraphQL querys here
	app.post('/graphql', bodyParser.json(), graphqlExpress(async (req/*, res*/) => {
		// TODO Read and Validate user
		return {
			context: {
				mongo
			},
			schema
		}
	}));

	// Setup playground interface for development mode
	if (process.env.NODE_ENV !== 'production') {
		app.use('/graphiql', graphiqlExpress({
			endpointURL: '/graphql'
		}));
	}

	app.listen(SERVER_PORT, () => {
		console.log(`Linky GraphQL server running on SERVER_port ${SERVER_PORT}`);
	});
}

// Log errors of unhadled promises
process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at:', p, 'reason:', reason);
});

// Let the show begin!
start();

// const start = async () => {
// 	const mongo = await connectToMongo();
// 	const app = express();

// 	app.use('/graphql', bodyParser.json(), graphqlExpress(async (req/*, res*/) => {
// 		const user = await authenticate(req, mongo.Users);
// 		return {
// 			context: {
// 				dataloaders: buildDataLoaders(mongo),
// 				mongo,
// 				user
// 			},
// 			formatError,
// 			schema
// 		}
// 	}));
// 	app.use('/graphiql', graphiqlExpress({
// 		endpointURL: '/graphql',
// 		passHeader: `'Authorization': 'bearer token-paquitosoftware@gmail.com'`,
// 		subscriptionsEndpoint: `ws://localhost:${SERVER_PORT}/subscriptions`
// 	}));

// 	// app.listen(SERVER_PORT, () => {
// 	// 	console.log(`Hackernews GrapQL server running on SERVER_port ${SERVER_PORT}`);
// 	// });
// 	const server = createServer(app);
// 	server.listen(SERVER_PORT, () => {
// 		SubscriptionServer.create(
// 			{ execute, subscribe, schema },
// 			{ server, path: '/subscriptions' }
// 		);
// 		console.log(`Hackernews GrapQL server running on SERVER_port ${SERVER_PORT}`);
// 	});
// };

// start();
