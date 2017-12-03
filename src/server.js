const express = require('express');
const bodyParser = require('body-parser');
const appConfig = require('./config/app-config');

// This package will handle GraphQL server requests and responses
// based on the provided schema definition
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');

const connectToMongo = require('./connectors/mongo-connector');
// const { authenticate } = require('./authentication');
// const buildDataLoaders = require('./data-loaders/data-loaders');
// const formatError = require('./format-error');

const SERVER_PORT = process.env.LINKY_API_SERVER_PORT || 3003;

const { getTypes, createSchema } = require('./types/');

async function start() {
	const mongo = await connectToMongo(getTypes(), appConfig.MONGO_URL);
	const app = express();
	const schema = createSchema();

	// Route all GraphQL querys here
	app.post('/graphql', bodyParser.json(), graphqlExpress(async (incomingMessage/*, res*/) => {
		// TODO Read and Validate user
		const authToken = incomingMessage.headers.authorization;
		return {
			context: {
				authToken: authToken ? /bearer (.*)/i.exec(authToken)[1] : null,
				mongo
			},
			schema
		};
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



const jwt = require('jsonwebtoken');
const { JWT_SECRET_KEY } = require('./config/app-config');

// const token = jwt.sign({ uid: '4238746894236875263784562893' }, JWT_SECRET_KEY);
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1MTIyOTAzOTV9.vWb6Wr48ho1Txidf4t46C4hVhKBKdg-rTfmTD1owBhM';
const decoded = jwt.verify(token, JWT_SECRET_KEY);

console.log(decoded);
