function health(_req, res) {
  res.json({
    ok: true,
    service: 'printstack-api',
  })
}

module.exports = { health }
