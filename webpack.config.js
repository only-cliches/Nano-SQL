const path = require('path');
const webpack = require("webpack");
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'examples')
};
const nodeExternals = require('webpack-node-externals');

const options = {
    entry: {
        'nano-sql': [path.join(__dirname, 'src', 'index.ts')]
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

    ],
    module: {
        loaders: [{
                test: /\.ts$/,
                loader: 'ts-loader'
            },
            {
                test: /\.txt$/,
                use: [{
                        loader: 'raw-loader'
                    },
                    {
                        loader: 'uglify-loader',
                        options: {
                            compress: {
                                warnings: false,
                                passes: 2
                            },
                            mangle: {
                                toplevel: true
                            }
                        }
                    }
                ]
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
        options['plugins'].push(new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false,
                passes: 2
            },
            mangle: {
                // props: { regex: new RegExp(/^_|Promise/) }
            }
        }));
        break;
}

module.exports = options;