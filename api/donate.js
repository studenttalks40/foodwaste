module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(200).json({
      message: "POST a donation payload to create a mock listing response.",
    });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

  if (!body.name || !body.donor || !body.location) {
    res.status(400).json({
      error: "Missing required fields: name, donor, location",
    });
    return;
  }

  res.status(200).json({
    ok: true,
    saved: false,
    item: {
      ...body,
      id: body.id || `food-${Date.now()}`,
      createdAt: new Date().toISOString(),
    },
  });
};
