const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    diff: './example/diff-example',
    fiber: './example/fiber-example',
  },
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '[name]-bundle.js',
    publicPath: '/',
  },
  module: {
    rules: [
      {
        test: /\.js/,
        loader: 'babel-loader',
      },
    ],
  },
  devtool: 'source-map',
  devServer: {
    contentBase: path.join(__dirname, 'public'),
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: './example/index.html', to: 'index.html' },
    ]),
  ],
};
