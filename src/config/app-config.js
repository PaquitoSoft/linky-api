module.exports = {
	MONGO_URL: process.env.LINKY_MONGO_URL ||
		'mongodb://localhost:27017/linky-dev',

	JWT_SECRET_KEY: process.env.LINKY_JWT_SECRET_KEY ||
		'SDAF0SAUF_FSD+FDSJAKFL@JFKDSLJL42937598',

	GITHUB_CLIENT_ID: process.env.LINKY_GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET: process.env.LINKY_GITHUB_CLIENT_SECRET,
	GITHUB_CALLBACK_URL: process.env.LINKY_GITHUB_CALLBACK_URL || 'http://localhost:3000/login-callback'
};
