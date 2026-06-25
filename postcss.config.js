/**
 * postcss.config.js — SLA Scorecard
 *
 * The existence of this file flips the hasPostcssConfig guard in webpack.config.js
 * to true, activating the postcss-loader rule for *.css files.
 */

"use strict";

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
