const express = require('express');
const bodyParser = require('body-parser');

// This package will handle GraphQL server requests and responses
// based on the provided schema definition
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');
const { formatError } = require('graphql');

const connectToMongo = require('./connectors/mongo-connector');
const appConfig = require('./config/app-config');
const loadersBuilder = require('./data-loaders/');

const { GITHUB_CLIENT_ID } = require('./config/app-config');

const SERVER_PORT = process.env.LINKY_API_SERVER_PORT || 3003;

const { getTypes, createSchema } = require('./types/');

async function start() {
	const mongo = await connectToMongo(getTypes(), appConfig.MONGO_URL);
	const app = express();
	const schema = createSchema();

	// Route all GraphQL querys here
	app.post('/graphql', bodyParser.json(), graphqlExpress(async (req/*, res*/) => {
		const authToken = req.headers.authorization;
		return {
			context: {
				authToken: authToken ? /bearer (.*)/i.exec(authToken)[1] : null,
				dataLoaders: loadersBuilder(mongo),
				mongo
			},
			formatError: error => {
				const data = formatError(error);
				data.statusCode = error.originalError && error.originalError.output ?
					error.originalError.output.statusCode : 500;
				return data;
			},
			schema
		};
	}));

	// Setup playground interface for development mode
	if (process.env.NODE_ENV !== 'production') {
		app.use('/graphiql', graphiqlExpress({
			endpointURL: '/graphql'
		}));

		// TODO This is only for testing purposes.
		// Remove when client is implemented
		app.get('/', (req, res) => {
			res.send(`
				<html>
					<head><title>Login with GitHub</title></head>
					<body>
						<p>Welcome to GitHub login test page</p>
						<section>
							<a href="https://github.com/login/oauth/authorize?scope=user:email&state=${Date.now()}&client_id=${GITHUB_CLIENT_ID}">Login</a>
						</section>
					</body>
				</html>
			`);
		});
		app.get('/callback', (req, res) => {
			const { code , state } = req.query;
			res.send(`
				<html>
					<head><title>Login with GitHub</title></head>
					<body>
						<p><a href="/">Welcome to GitHub login test page</a></p>
						<section>
							<p>Code: ${code}</p>
							<p>State: ${state}</p>
						</section>
					</body>
				</html>
			`);
		});
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
