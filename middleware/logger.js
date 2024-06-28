function logger(req, res, next) {
  console.log(`NEW REQUEST
    METHOD: ${req.method}
    PATH: ${req.path}
    TIME: ${req.requestTime}
    QUERY: ${JSON.stringify(req.query)}
     `);
  next();
}

module.exports = logger;