const path = require('path');
const PATHS = {
    app: path.join(__dirname, 'src'),
    build: path.join(__dirname, 'dist')
};


const options = {
    entry: {
        'plugin-fuzzy-search': [path.join(__dirname, 'src', 'index.ts')],
    },
    output: {
        path: PATHS.build,
        filename: '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    externals: {
        "@nano-sql/core": '@nano-sql/core'
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