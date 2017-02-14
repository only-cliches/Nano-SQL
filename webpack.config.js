const path = require('path');
const webpack = require("webpack");
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'dist')
};
const WriteFilePlugin = require("write-file-webpack-plugin");

var options = {
    entry: {
        'some-sql': [path.join(__dirname, 'src', 'index.ts')]
    },
    watch: false,
    output: {
        path: PATHS.build,
        filename: '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    resolve: {
        extensions: ['.ts', '.tsx']
    },
    plugins: [],
    module: {
        loaders: [{
            test: /\.ts$/,
            loader: 'ts-loader'
        }]
    }
};

switch(process.env.NODE_ENV) {
    case "development":
        /*options['watch'] = true;
        options['plugins'].push(new WriteFilePlugin());
        options['devServer'] = {
            contentBase: "./",
            outputPath: path.join(__dirname, './dist')
        };*/
    break;  
    case "build": //for nodejs index.js
        options['externals'] = ['typescript-map','typescript-promise'];
    break;
    case "production":
        options['plugins'].push(new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false
            },
            mangle:{
                props:{regex:new RegExp(/^_|TSPromise/)}
            }
        }));
    break;
}

module.exports = options;