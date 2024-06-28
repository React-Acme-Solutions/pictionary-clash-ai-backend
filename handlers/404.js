function handleNotFound(req, res) {
  const errorObject = {
    status: 404,
    error: 'Not Found',
    path: req.path,
  };
  res.status(404).json(errorObject);
}

module.exports = handleNotFound;