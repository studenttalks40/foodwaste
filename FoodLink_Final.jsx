// =========================================
// FOODLINK — FINAL CLEAN VERSION 🚀
// Fixed:
// - Search only in Browse
// - Working filters
// - Fake Map
// - Clean deploy-ready
// =========================================

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const LOCATIONS = {
  "Mumbai Central": { lat: 19.076, lng: 72.877 },
  Andheri: { lat: 19.1136, lng: 72.8697 },
  Bandra: { lat: 19.0596, lng: 72.8295 },
  Dadar: { lat: 19.0176, lng: 72.8562 }
};

function getDistance(a, b) {
  if (!a || !b) return 999;
  return Math.sqrt(
    Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2)
  );
}

export default function App() {
  const [view, setView] = useState("home");

  const [foodList, setFoodList] = useState([
    {
      id: 1,
      name: "Rice & Dal",
      quantity: 20,
      location: "Mumbai Central",
      status: "available",
      createdAt: Date.now(),
      expiresInMin: 120,
      image: "https://images.unsplash.com/photo-1604908176997-4310f7c1c0d0"
    }
  ]);

  const addFood = (food) => {
    if (!food.name || !food.quantity || !food.location) return;

    setFoodList((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: food.name,
        quantity: Number(food.quantity),
        location: food.location,
        status: "available",
        createdAt: Date.now(),
        expiresInMin: 180,
        image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"
      }
    ]);

    setView("list");
  };

  const claimFood = (id) => {
    setFoodList((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "claimed" } : f))
    );
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24">
      <h1 className="text-3xl font-bold mb-4">🍱 FoodLink</h1>

      {view === "home" && (
        <div className="space-y-4">
          <button onClick={() => setView("donate")} className="bg-green-500 p-3 w-full">Donate</button>
          <button onClick={() => setView("list")} className="bg-blue-500 p-3 w-full">Browse</button>
        </div>
      )}

      {view === "donate" && <DonateForm onAdd={addFood} />}
      {view === "list" && <Browse data={foodList} onClaim={claimFood} />}
    </div>
  );
}

// ---------------- Browse ----------------
function Browse({ data, onClaim }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const scored = useMemo(() => {
    const userLoc = LOCATIONS["Mumbai Central"];

    return data
      .filter((f) => {
        const matchSearch =
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.location.toLowerCase().includes(query.toLowerCase());

        const matchFilter =
          filter === "All" || (filter === "Urgent" && f.expiresInMin < 60);

        return matchSearch && matchFilter;
      })
      .map((item) => {
        const dist = getDistance(userLoc, LOCATIONS[item.location]);
        const remainingMin = Math.max(
          0,
          item.expiresInMin - Math.floor((now - item.createdAt) / 60000)
        );
        return { ...item, dist, remainingMin };
      });
  }, [data, query, filter, now]);

  return (
    <div className="space-y-4">
      <input
        placeholder="Search food..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full p-2 bg-gray-800"
      />

      <div className="flex gap-2">
        {["All", "Urgent"].map((c) => (
          <button key={c} onClick={() => setFilter(c)} className="bg-gray-700 px-3 py-1">
            {c}
          </button>
        ))}
      </div>

      <FakeMap data={scored} />

      {scored.map((item) => (
        <div key={item.id} className="bg-gray-800 p-3">
          <p>{item.name}</p>
          <p>{item.location}</p>
          <button onClick={() => onClaim(item.id)}>Claim</button>
        </div>
      ))}
    </div>
  );
}

// ---------------- Fake Map ----------------
function FakeMap({ data }) {
  return (
    <div className="bg-gray-800 h-40 relative">
      {data.map((item, i) => (
        <div key={i} className="absolute" style={{ top: 20 + i * 20, left: 30 + i * 40 }}>
          📍
        </div>
      ))}
    </div>
  );
}

// ---------------- Donate ----------------
function DonateForm({ onAdd }) {
  const [form, setForm] = useState({ name: "", quantity: "", location: "" });

  return (
    <div>
      <input placeholder="Food" onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input placeholder="Qty" onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
      <input placeholder="Location" onChange={(e) => setForm({ ...form, location: e.target.value })} />
      <button onClick={() => onAdd(form)}>Submit</button>
    </div>
  );
}
