const path = require('path');
const webpack = require("webpack");
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'dist')
};
const nodeExternals = require('webpack-node-externals');

const options = {
    entry: {
        'sqlite': [path.join(__dirname, 'src', 'plugin.ts')],
    },
    output: {
        path: PATHS.build,
        filename: '[name].js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    node: {
        global: false,
        process: false
    },
    optimization: {
		minimize: false
	},
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader'
            }
        ]
    }
};

module.exports = options;