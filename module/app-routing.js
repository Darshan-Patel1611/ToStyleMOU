class routing {
    v1(app) {
        var user = require('./v1/user/route/routes');
        user(app);
    }
}

module.exports = new routing();