module.exports = {
    entry: './index.js',
    output: {
      filename: 'nano-sql-vue.min.js',
      libraryTarget: 'umd',
      umdNamedDefine: true
    },
    externals: ["nano-sql"],
  };