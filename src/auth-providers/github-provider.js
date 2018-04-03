const request = require('request-promise-native');
const Boom = require('boom');
const {
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET,
	GITHUB_CALLBACK_URL,
} = require('../config/app-config');

module.exports = function githubProvider(token, hash) {
	return new Promise((resolve, reject) => {
		const reqData = {
			client_id: GITHUB_CLIENT_ID,
			client_secret: GITHUB_CLIENT_SECRET,
			redirect_uri: GITHUB_CALLBACK_URL,
			code: token,
			state: hash,
			scope: 'user:email read:user'
		};

		let reqOptions = {
			method: 'POST',
			url: 'https://github.com/login/oauth/access_token',
			body: reqData,
			json: true
		};

		console.log('Access token request:', reqOptions);
		request(reqOptions)
			.then(resData => {
				console.log('Access token response:', resData);
				if (resData.error) {
					const error = new Error(resData.error);
					error.description = resData.error_description;
					return reject(error);
				}

				reqOptions = {
					url: 'https://api.github.com/user',
					headers: {
						'Authorization': `Bearer ${resData.access_token}`,
						'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36'
					},
					json: true
				};
				console.log('User info request');
				request(reqOptions)
					.then(userData => {
						console.log('User Data:', userData);

						if (!userData.email) {
							reject(Boom.preconditionFailed('Your GitHub user must have a public email'));
						}

						resolve(userData);
					})
					.catch(reject);
			})
			.catch(reject);
	});
};


/*
	GitHub user data
	{
		login: 'PaquitoSoft',
		id: 166022,
		avatar_url: 'https://avatars3.githubusercontent.com/u/166022?v=4',
		gravatar_id: '',
		url: 'https://api.github.com/users/PaquitoSoft',
		html_url: 'https://github.com/PaquitoSoft',
		followers_url: 'https://api.github.com/users/PaquitoSoft/followers',
		following_url: 'https://api.github.com/users/PaquitoSoft/following{/other_user}',
		gists_url: 'https://api.github.com/users/PaquitoSoft/gists{/gist_id}',
		starred_url: 'https://api.github.com/users/PaquitoSoft/starred{/owner}{/repo}',
		subscriptions_url: 'https://api.github.com/users/PaquitoSoft/subscriptions',
		organizations_url: 'https://api.github.com/users/PaquitoSoft/orgs',
		repos_url: 'https://api.github.com/users/PaquitoSoft/repos',
		events_url: 'https://api.github.com/users/PaquitoSoft/events{/privacy}',
		received_events_url: 'https://api.github.com/users/PaquitoSoft/received_events',
		type: 'User',
		site_admin: false,
		name: 'PaquitoSoft',
		company: null,
		blog: 'http://paquitosoftware.com',
		location: 'Spain',
		email: 'paquitosoftware@gmail.com',
		hireable: null,
		bio: null,
		public_repos: 45,
		public_gists: 15,
		followers: 20,
		following: 4,
		created_at: '2009-12-11T08:42:03Z',
		updated_at: '2017-12-06T12:11:02Z'
	}
*/
