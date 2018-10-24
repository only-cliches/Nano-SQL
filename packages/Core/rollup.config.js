import typescript from 'rollup-plugin-typescript';
import commonjs from 'rollup-plugin-commonjs';
import { uglify } from "rollup-plugin-uglify";

export default {
    input: './src/index.ts',
    plugins: [
        typescript({module: 'CommonJS'}),
        commonjs({extensions: ['.js', '.ts']}),
        uglify({
            mangle: {
                properties: { regex: new RegExp(/^_/) }
            }
        })
    ],
    output: {
        file: 'nano-sql-rollup.min.js',
        format: "umd",
        name: "nSQL",
        exports: "named"
    }
}