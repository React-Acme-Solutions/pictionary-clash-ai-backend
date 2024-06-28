function timestamp(req, res, next) {
  req.requestTime = new Date();
  res.header('RT', req.requestTime);
  next();
}

module.exports = timestamp;