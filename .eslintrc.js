module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
		"sourceType": "module",
		"ecmaVersion": 8,
		"ecmaFeatures": {
            "experimentalObjectRestSpread": true
        }
    },
    "rules": {
        "indent": [
            "error",
			"tab",
			{
				"SwitchCase": 1
			}
        ],
        // "linebreak-style": [
        //     "error",
        //     "unix"
        // ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
		],
		"no-console": [
			"error",
			{ allow: ["warn"] }
		]
    }
};
