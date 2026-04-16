import { useEffect, useMemo, useState } from "react";
import seed from "../data/seed.json";

const STORAGE_KEY = "foodlink-state-v1";
const TAB_COPY = {
  browse: {
    title: "Browse nearby food",
    note: "Pick up surplus meals before they expire and help communities use good food first.",
  },
  donate: {
    title: "List food in seconds",
    note: "Share a tray, basket, or pantry item and let local rescuers claim it fast.",
  },
  recipes: {
    title: "Teach reuse recipes",
    note: "Turn leftovers into something new with short, practical recipe ideas.",
  },
  impact: {
    title: "Track food waste",
    note: "See what the network is rescuing and where the biggest waste wins are happening.",
  },
};
const FILTERS = ["all", "urgent", "nearby", "vegetarian", "claimed"];
const DEFAULT_FORM = {
  name: "Community dinner tray",
  donor: "Your kitchen",
  location: seed.locations[0]?.label ?? "Andheri West",
  servings: "12",
  expiresInMinutes: "60",
  category: "Prepared meal",
  image:
    seed.listings[0]?.image ??
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
  tags: "Vegetarian, Pickup now",
  note: "Add a short note so rescuers know how to use the food.",
};
const DEFAULT_IMPACT = seed.impact;

function normalizeListing(item = {}, index = 0) {
  const expiresInMinutes = Number(item.expiresInMinutes ?? 60);
  return {
    id: item.id ?? `food-${index + 1}`,
    name: item.name ?? "Community meal",
    donor: item.donor ?? "Local kitchen",
    location: item.location ?? seed.locations[0]?.label ?? "Andheri West",
    distanceKm: Number(item.distanceKm ?? 1.5),
    servings: Number(item.servings ?? 8),
    expiresInMinutes,
    expiresAt:
      item.expiresAt != null ? Number(item.expiresAt) : Date.now() + expiresInMinutes * 60_000,
    category: item.category ?? "Prepared meal",
    status: item.status ?? "available",
    image:
      item.image ??
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
    tags: Array.isArray(item.tags) ? item.tags : [],
    note: item.note ?? "",
    claimedAt: item.claimedAt ?? null,
  };
}

function normalizeState(source = {}) {
  return {
    activeTab: source.activeTab ?? "browse",
    search: source.search ?? "",
    filter: source.filter ?? "all",
    form: { ...DEFAULT_FORM, ...(source.form ?? {}) },
    impact: { ...DEFAULT_IMPACT, ...(source.impact ?? {}) },
    listings: Array.isArray(source.listings)
      ? source.listings.map((item, index) => normalizeListing(item, index))
      : seed.listings.map((item, index) => normalizeListing(item, index)),
    recipes: Array.isArray(source.recipes) ? source.recipes : seed.recipes,
    stories: Array.isArray(source.stories) ? source.stories : seed.stories,
    hydrated: Boolean(source.hydrated),
  };
}

function loadInitialState() {
  if (typeof window === "undefined") return normalizeState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState({ ...JSON.parse(raw), hydrated: true }) : normalizeState();
  } catch {
    return normalizeState();
  }
}

function formatMinutes(value) {
  if (value <= 0) return "Expired";
  if (value === 1) return "1 min left";
  return `${value} min left`;
}

function formatDistance(value) {
  return `${value.toFixed(1)} km`;
}

function cardStyle(image, overlay = "rgba(251, 247, 240, 0.1)") {
  return {
    backgroundImage: `linear-gradient(180deg, ${overlay}, rgba(17, 18, 14, 0.28)), url(${image})`,
  };
}

export default function App() {
  const [now, setNow] = useState(() => Date.now());
  const [state, setState] = useState(() => loadInitialState());
  const [banner, setBanner] = useState("Local demo ready");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const { hydrated, ...persistable } = state;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  }, [state]);

  useEffect(() => {
    if (state.hydrated) return;
    let alive = true;
    fetch("/api/dashboard")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setState((current) =>
          normalizeState({
            ...current,
            listings: Array.isArray(data.listings) ? data.listings : current.listings,
            recipes: Array.isArray(data.recipes) ? data.recipes : current.recipes,
            stories: Array.isArray(data.stories) ? data.stories : current.stories,
            impact: data.impact ? { ...current.impact, ...data.impact } : current.impact,
            hydrated: true,
          }),
        );
        setBanner("Hydrated from /api/dashboard");
      })
      .catch(() => {
        if (alive) setBanner("Running from local seed data");
      });
    return () => {
      alive = false;
    };
  }, [state.hydrated]);

  const listingsWithStatus = useMemo(() => {
    return state.listings.map((item) => {
      const remainingMinutes = Math.max(0, Math.ceil((Number(item.expiresAt) - now) / 60_000));
      return {
        ...item,
        remainingMinutes,
        isUrgent: item.status === "available" && remainingMinutes <= 60,
        isNearby: item.distanceKm <= 2.5,
      };
    });
  }, [state.listings, now]);

  const filteredListings = useMemo(() => {
    const query = state.search.trim().toLowerCase();
    return listingsWithStatus.filter((item) => {
      const haystack = [item.name, item.donor, item.location, item.category, item.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesFilter =
        state.filter === "all" ||
        (state.filter === "urgent" && item.isUrgent) ||
        (state.filter === "nearby" && item.isNearby) ||
        (state.filter === "vegetarian" && item.tags.includes("Vegetarian")) ||
        (state.filter === "claimed" && item.status === "claimed");
      return matchesQuery && matchesFilter;
    });
  }, [listingsWithStatus, state.search, state.filter]);

  const counters = useMemo(() => {
    return {
      available: listingsWithStatus.filter((item) => item.status === "available").length,
      urgent: listingsWithStatus.filter((item) => item.isUrgent).length,
      claimed: listingsWithStatus.filter((item) => item.status === "claimed").length,
    };
  }, [listingsWithStatus]);

  const categoryBreakdown = useMemo(() => {
    const buckets = ["Prepared meal", "Produce", "Bakery", "Pantry"];
    return buckets.map((bucket) => {
      const count = listingsWithStatus.filter((item) => item.category === bucket).length;
      return {
        label: bucket,
        count,
        percent: Math.min(100, Math.round((count / Math.max(1, listingsWithStatus.length)) * 100)),
      };
    });
  }, [listingsWithStatus]);

  const visibleStory = state.stories[0];
  const weeklyProgress = Math.min(100, Math.round((state.impact.mealsSaved / state.impact.weeklyGoal) * 100));

  const updateState = (updater) => setState((current) => normalizeState(updater(current)));
  const setTab = (tab) => updateState((current) => ({ ...current, activeTab: tab }));
  const setField = (field, value) =>
    updateState((current) => ({ ...current, form: { ...current.form, [field]: value } }));

  function handleClaim(listingId) {
    updateState((current) => {
      const listing = current.listings.find((item) => item.id === listingId);
      if (!listing || listing.status !== "available") return current;
      return {
        ...current,
        listings: current.listings.map((item) =>
          item.id === listingId ? { ...item, status: "claimed", claimedAt: Date.now() } : item,
        ),
        impact: {
          ...current.impact,
          mealsSaved: current.impact.mealsSaved + listing.servings,
          wasteDivertedKg:
            current.impact.wasteDivertedKg + Math.max(1, Math.round(listing.servings * 0.6)),
          co2AvoidedKg:
            current.impact.co2AvoidedKg + Math.max(1, Math.round(listing.servings * 0.4)),
        },
      };
    });
    setBanner("Food claimed successfully");
  }

  async function handleDonate(event) {
    event.preventDefault();
    const name = state.form.name.trim();
    const donor = state.form.donor.trim();
    const location = state.form.location.trim();
    const servings = Math.max(1, Number(state.form.servings) || 0);
    const expiresInMinutes = Math.max(10, Number(state.form.expiresInMinutes) || 0);
    if (!name || !donor || !location) {
      setBanner("Please fill out the meal name, donor, and location");
      return;
    }

    const locationMatch = seed.locations.find((item) => item.label === location);
    const listing = normalizeListing({
      id: `food-${Date.now()}`,
      name,
      donor,
      location,
      distanceKm: locationMatch?.distanceKm ?? 2.5,
      servings,
      expiresInMinutes,
      expiresAt: Date.now() + expiresInMinutes * 60_000,
      category: state.form.category,
      status: "available",
      image: state.form.image,
      tags: state.form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      note: state.form.note.trim(),
    });

    updateState((current) => ({
      ...current,
      activeTab: "browse",
      impact: { ...current.impact, listingsShared: current.impact.listingsShared + 1 },
      listings: [listing, ...current.listings],
      form: {
        ...DEFAULT_FORM,
        donor: donor || DEFAULT_FORM.donor,
        image: seed.listings[(current.listings.length + 1) % seed.listings.length]?.image ?? DEFAULT_FORM.image,
      },
    }));

    try {
      await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listing),
      });
    } catch {
      // Local demo fallback.
    }

    setBanner("Meal listed and sent to the API queue");
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="ambient ambient-c" />
      <div className="page">
        <header className="topbar glass-panel">
          <div className="brand">
            <span className="brand-mark" />
            <div>
              <p className="brand-kicker">FoodLink</p>
              <h1>Redistribute food. Reduce waste.</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="status-pill">{banner}</span>
            <button className="ghost-button" onClick={() => setTab("browse")}>
              Browse
            </button>
            <button className="primary-button" onClick={() => setTab("donate")}>
              Donate food
            </button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-copy glass-panel">
            <div>
              <p className="eyebrow">Social food rescue, built for neighborhoods</p>
              <h2>
                A warm, modern app for sharing surplus meals, teaching reuse recipes, and
                keeping food out of the bin.
              </h2>
              <p className="hero-text">
                FoodLink makes it easy to donate, browse, claim, and learn what to cook next.
                The experience is inspired by the playful social-food direction in the Grubbe
                shot, with a softer palette and a more community-first flow.
              </p>
            </div>
            <div>
              <div className="hero-actions">
                <button className="primary-button" onClick={() => setTab("browse")}>
                  Browse nearby food
                </button>
                <button className="ghost-button" onClick={() => setTab("recipes")}>
                  Explore recipes
                </button>
              </div>
              <div className="metrics-grid">
                <MetricCard label="Meals rescued" value={state.impact.mealsSaved.toLocaleString()} />
                <MetricCard label="Waste diverted" value={`${state.impact.wasteDivertedKg.toLocaleString()} kg`} />
                <MetricCard label="CO2 avoided" value={`${state.impact.co2AvoidedKg.toLocaleString()} kg`} />
                <MetricCard label="Posts shared" value={state.impact.listingsShared.toLocaleString()} />
              </div>
            </div>
          </div>

          <div className="phone-frame glass-panel">
            <div className="phone-top">
              <div>
                <p className="phone-label">Live nearby feed</p>
                <h3>Claim what is close</h3>
              </div>
              <span className="chip chip-soft">92% claimed in 20 min</span>
            </div>
            <div className="phone-feed">
              {listingsWithStatus.slice(0, 3).map((item) => (
                <article className="mini-listing" key={item.id}>
                  <div className="mini-image" style={cardStyle(item.image)} />
                  <div className="mini-copy">
                    <div className="mini-row">
                      <h4>{item.name}</h4>
                      <span className={`tiny-pill ${item.status}`}>{item.status}</span>
                    </div>
                    <p>
                      {item.location} · {formatDistance(item.distanceKm)}
                    </p>
                    <div className="mini-meta">
                      <span>{formatMinutes(item.remainingMinutes)}</span>
                      <span>{item.servings} servings</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="phone-bottom">
              <button className="phone-action active" onClick={() => setTab("browse")}>
                Browse
              </button>
              <button className="phone-action" onClick={() => setTab("donate")}>
                Donate
              </button>
              <button className="phone-action" onClick={() => setTab("impact")}>
                Impact
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="main-column">
            <div className="section-head glass-panel">
              <div>
                <p className="eyebrow">What people are doing right now</p>
                <h3>{TAB_COPY[state.activeTab].title}</h3>
                <p>{TAB_COPY[state.activeTab].note}</p>
              </div>
              <div className="tab-row">
                {Object.keys(TAB_COPY).map((tab) => (
                  <button
                    key={tab}
                    className={`tab-button ${state.activeTab === tab ? "active" : ""}`}
                    onClick={() => setTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {state.activeTab === "browse" && (
              <section className="stack">
                <div className="browse-tools glass-panel">
                  <label className="search-box">
                    <span>Search</span>
                    <input
                      value={state.search}
                      onChange={(event) => updateState((current) => ({ ...current, search: event.target.value }))}
                      placeholder="Rice, fruit, bakery, soup..."
                    />
                  </label>
                  <div className="filter-row">
                    {FILTERS.map((item) => (
                      <button
                        key={item}
                        className={`filter-chip ${state.filter === item ? "active" : ""}`}
                        onClick={() => updateState((current) => ({ ...current, filter: item }))}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="listing-grid">
                  {filteredListings.map((item) => (
                    <ListingCard key={item.id} item={item} onClaim={handleClaim} />
                  ))}
                </div>
                <div className="browse-footer glass-panel">
                  <div>
                    <p className="eyebrow">Nearby summary</p>
                    <h4>
                      {counters.available} available · {counters.urgent} urgent · {counters.claimed} claimed
                    </h4>
                  </div>
                  <div className="summary-badges">
                    <span className="chip">{formatDistance(listingsWithStatus[0]?.distanceKm ?? 0)}</span>
                    <span className="chip chip-soft">Real-time countdown</span>
                  </div>
                </div>
              </section>
            )}

            {state.activeTab === "donate" && (
              <section className="stack">
                <form className="donate-form glass-panel" onSubmit={handleDonate}>
                  <div className="form-grid">
                    <Field label="Meal name">
                      <input
                        value={state.form.name}
                        onChange={(event) => setField("name", event.target.value)}
                        placeholder="Sunday family tray"
                      />
                    </Field>
                    <Field label="Donor / kitchen">
                      <input
                        value={state.form.donor}
                        onChange={(event) => setField("donor", event.target.value)}
                        placeholder="Cafe, home kitchen, hostel"
                      />
                    </Field>
                    <Field label="Location">
                      <select
                        value={state.form.location}
                        onChange={(event) => setField("location", event.target.value)}
                      >
                        {seed.locations.map((location) => (
                          <option key={location.label} value={location.label}>
                            {location.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Category">
                      <select
                        value={state.form.category}
                        onChange={(event) => setField("category", event.target.value)}
                      >
                        <option value="Prepared meal">Prepared meal</option>
                        <option value="Produce">Produce</option>
                        <option value="Bakery">Bakery</option>
                        <option value="Pantry">Pantry</option>
                      </select>
                    </Field>
                    <Field label="Servings">
                      <input
                        type="number"
                        min="1"
                        value={state.form.servings}
                        onChange={(event) => setField("servings", event.target.value)}
                      />
                    </Field>
                    <Field label="Expires in (minutes)">
                      <input
                        type="number"
                        min="10"
                        value={state.form.expiresInMinutes}
                        onChange={(event) => setField("expiresInMinutes", event.target.value)}
                      />
                    </Field>
                    <Field label="Image URL">
                      <input
                        value={state.form.image}
                        onChange={(event) => setField("image", event.target.value)}
                        placeholder="Paste a food image URL"
                      />
                    </Field>
                    <Field label="Tags">
                      <input
                        value={state.form.tags}
                        onChange={(event) => setField("tags", event.target.value)}
                        placeholder="Vegetarian, Pickup now"
                      />
                    </Field>
                  </div>

                  <Field label="Notes">
                    <textarea
                      rows="4"
                      value={state.form.note}
                      onChange={(event) => setField("note", event.target.value)}
                      placeholder="Anything helpful for the person claiming the food?"
                    />
                  </Field>

                  <div className="form-footer">
                    <p>
                      This form also posts to <code>/api/donate</code> so your Vercel deploy has a
                      real API endpoint to connect to.
                    </p>
                    <button className="primary-button" type="submit">
                      Publish donation
                    </button>
                  </div>
                </form>

                <div className="listing-grid compact">
                  {listingsWithStatus.slice(0, 3).map((item) => (
                    <ListingCard key={`preview-${item.id}`} item={item} onClaim={handleClaim} />
                  ))}
                </div>
              </section>
            )}

            {state.activeTab === "recipes" && (
              <section className="stack">
                <div className="recipe-grid">
                  {state.recipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.title}
                      recipe={recipe}
                      onOpen={() => setBanner(`Recipe selected: ${recipe.title}`)}
                    />
                  ))}
                </div>
                <div className="reuse-banner glass-panel">
                  <div>
                    <p className="eyebrow">Reuse education</p>
                    <h4>Teach the habit, not just the rescue.</h4>
                    <p>
                      Every recipe card is built to show practical reuse ideas for people who are
                      new to food rescue.
                    </p>
                  </div>
                  <div className="story-preview">
                    <div className="story-thumb" style={cardStyle(visibleStory?.image)} />
                    <div>
                      <p>{visibleStory?.text}</p>
                      <span>
                        {visibleStory?.name} · {visibleStory?.time}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {state.activeTab === "impact" && (
              <section className="stack">
                <div className="impact-grid">
                  <div className="impact-card glass-panel">
                    <p className="eyebrow">Weekly goal</p>
                    <h3>{weeklyProgress}%</h3>
                    <div className="progress-track" aria-hidden="true">
                      <span style={{ width: `${weeklyProgress}%` }} />
                    </div>
                    <p>
                      {state.impact.mealsSaved.toLocaleString()} meals saved toward{" "}
                      {state.impact.weeklyGoal.toLocaleString()} target.
                    </p>
                  </div>
                  <div className="impact-card glass-panel">
                    <p className="eyebrow">Waste breakdown</p>
                    <div className="bar-list">
                      {categoryBreakdown.map((item) => (
                        <div className="bar-row" key={item.label}>
                          <span>{item.label}</span>
                          <div className="progress-track small">
                            <span style={{ width: `${Math.max(item.percent, 12)}%` }} />
                          </div>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="story-feed glass-panel">
                  <div className="section-mini-head">
                    <div>
                      <p className="eyebrow">Social proof</p>
                      <h4>People are sharing, claiming, and cooking together.</h4>
                    </div>
                    <span className="chip chip-soft">Community live feed</span>
                  </div>
                  <div className="story-row">
                    {state.stories.map((story) => (
                      <article className="story-card" key={story.name}>
                        <div className="story-image" style={cardStyle(story.image)} />
                        <div className="story-copy">
                          <div className="mini-row">
                            <h5>{story.name}</h5>
                            <span>{story.time}</span>
                          </div>
                          <p>{story.text}</p>
                          <span className="muted">{story.handle}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="side-column">
            <div className="map-card glass-panel">
              <div className="section-mini-head">
                <div>
                  <p className="eyebrow">Nearby map</p>
                  <h4>Pickup lanes around you</h4>
                </div>
                <span className="chip chip-soft">Live radius</span>
              </div>
              <div className="mini-map" aria-hidden="true">
                <span className="map-grid" />
                <span className="map-route" />
                <span className="map-pin pin-a" />
                <span className="map-pin pin-b" />
                <span className="map-pin pin-c" />
              </div>
              <div className="map-list">
                {listingsWithStatus.slice(0, 4).map((item) => (
                  <div key={`${item.id}-map`} className="map-row">
                    <strong>{item.location}</strong>
                    <span>{formatDistance(item.distanceKm)} away</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RecipeCard({ recipe, onOpen }) {
  return (
    <article className="recipe-card glass-panel">
      <div className="recipe-media" style={cardStyle(recipe.image, "rgba(42, 36, 29, 0.12)")} />
      <div className="recipe-copy">
        <div className="mini-row">
          <p className="eyebrow">Reuse recipe</p>
          <span className="chip chip-soft">{recipe.time}</span>
        </div>
        <h4>{recipe.title}</h4>
        <p>{recipe.summary}</p>
        <div className="tag-row">
          {recipe.ingredients.map((ingredient) => (
            <span className="chip" key={ingredient}>
              {ingredient}
            </span>
          ))}
        </div>
        <div className="listing-footer recipe-footer">
          <strong>{recipe.servings} servings</strong>
          <button className="ghost-button" onClick={onOpen}>
            Open recipe
          </button>
        </div>
      </div>
    </article>
  );
}

function ListingCard({ item, onClaim }) {
  const availability = item.status === "claimed" ? "Claimed" : formatMinutes(item.remainingMinutes);
  const isExpired = item.remainingMinutes <= 0 && item.status === "available";
  return (
    <article className="listing-card glass-panel">
      <div className="listing-media" style={cardStyle(item.image)} />
      <div className="listing-copy">
        <div className="mini-row">
          <div>
            <p className="eyebrow">{item.category}</p>
            <h4>{item.name}</h4>
          </div>
          <span className={`tiny-pill ${item.status}`}>{item.status}</span>
        </div>
        <p className="listing-note">{item.note}</p>
        <div className="listing-meta">
          <span>{item.donor}</span>
          <span>{item.location}</span>
          <span>{formatDistance(item.distanceKm)}</span>
        </div>
        <div className="tag-row">
          {item.tags.map((tag) => (
            <span className="chip chip-soft" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className="listing-footer">
          <div>
            <strong>{item.servings} servings</strong>
            <p>{availability}</p>
          </div>
          <button
            className="primary-button"
            onClick={() => onClaim(item.id)}
            disabled={item.status !== "available" || isExpired}
          >
            {item.status === "claimed" ? "Claimed" : isExpired ? "Expired" : "Claim food"}
          </button>
        </div>
      </div>
    </article>
  );
}
