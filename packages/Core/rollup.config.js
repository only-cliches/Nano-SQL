import typescript from 'rollup-plugin-typescript';

export default {
    input: './src/index.ts',
    plugins: [
        typescript({
            typescript: require('typescript'),
            module: 'CommonJS'
        })
    ],
    output: {
        file: 'nano-sql-rollup.min.js',
        format: "umd",
        name: "nSQL",
        exports: "named"
    }
}