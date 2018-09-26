var parser = require("./alasqlparser");
require("./28yy").fn(parser.parser.yy);
module.exports = {
    parser: function(sql) {
        return parser.parse(sql);
    }
};
// console.log(JSON.stringify(parser.parse("SELECT * FROM Bees b WHERE wings LIKE ? AND limbs = ?", null, 4)));