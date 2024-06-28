function handleError(error, req, res, next) {
  const errorObject = {
    status: 500,
    error: error.message,
    path: req.path,
  };

  res.status(500).json(errorObject);
}

module.exports = handleError;