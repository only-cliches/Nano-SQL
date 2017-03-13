const path = require('path');
const webpack = require("webpack");
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname)
};

var options = {
    entry: {
        'react-playground': [path.join(__dirname, 'src', 'index.tsx')]
    },
    watch: false,
    output: {
        path: PATHS.build,
        filename: '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    resolve: {
        extensions: ['.ts', '.tsx', ".js"]
    },
    plugins: [],
    module: {
        loaders: [{
            test: /\.ts|\.tsx$/,
            loader: 'ts-loader'
        }]
    }
};

switch (process.env.NODE_ENV) {
    case "production":
        options['plugins'].push(new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false
            }
        }));
        options["plugins"].push(new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(process.env.NODE_ENV),
            },
        }));
        break;
}

module.exports = options;