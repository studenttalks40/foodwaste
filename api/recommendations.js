const seed = require("../data/seed.json");

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    recipes: seed.recipes,
    stories: seed.stories,
  });
};
