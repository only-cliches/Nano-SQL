const path = require('path');
const webpack = require("webpack");
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'examples')
};
const nodeExternals = require('webpack-node-externals');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

const options = {
    entry: {
        'nano-sql': [path.join(__dirname, 'src', 'index.ts')],
        'adapter-test': [path.join(__dirname, "src", "adapter-test.ts")]
    },
    output: {
        path: PATHS.build,
        filename: '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    devServer: {
        historyApiFallback: true,
        inline: false,
        contentBase: "examples",
    },
    watchOptions: {
        aggregateTimeout: 500,
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    node: {
        console: false,
        global: false,
        process: false,
        Buffer: false,
        setImmediate: false
    },
    plugins: [
        new UglifyJSPlugin({
            uglifyOptions: {
                mangle: {
                    properties: { regex: new RegExp(/^_|Promise/) }
                }
            }
        })
    ],
    module: {
        rules: [{
                test: /\.ts$/,
                loader: 'ts-loader'
            },
            {
                test: /\.ts$/,
                loader: "webpack-strip-block?start=NODE-START&end=NODE-END"
            }
        ]
    }
};

switch (process.env.NODE_ENV) {
    case "production":
        /*options.optimization = {
            minimizer: [
                new UglifyJSPlugin({
                    uglifyOptions: {
                        compress: {
                            warnings: false,
                            passes: 2
                        },
                        mangle: {
                            props: { regex: new RegExp(/^_|Promise/) }
                        }
                    }
                })
            ]
        };*/
        break;
}

module.exports = options;