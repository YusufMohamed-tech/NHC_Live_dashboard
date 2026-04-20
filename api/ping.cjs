module.exports = (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).send('pong')
  }
  return res.status(405).send('Method not allowed')
}
