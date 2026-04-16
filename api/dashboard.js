const seed = require("../data/seed.json");

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    impact: seed.impact,
    locations: seed.locations,
    stories: seed.stories,
    recipes: seed.recipes,
    listings: seed.listings,
    source: "api",
  });
};
