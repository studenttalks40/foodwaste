import { useEffect, useMemo, useState } from "react";

const LOCATIONS = {
  "Mumbai Central": { lat: 19.076, lng: 72.877 },
  Andheri: { lat: 19.1136, lng: 72.8697 },
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
    }
  ]);

  const addFood = (food) => {
    if (!food.name || !food.quantity || !food.location) return;
    setFoodList([...foodList, { ...food, id: Date.now(), status: "available" }]);
    setView("list");
  };

  const claimFood = (id) => {
    setFoodList(foodList.map(f => f.id === id ? { ...f, status: "claimed" } : f));
  };

  return (
    <div style={{padding:20, color:"white", background:"black", minHeight:"100vh"}}>
      <h1>FoodLink</h1>

      {view === "home" && (
        <>
          <button onClick={()=>setView("donate")}>Donate</button>
          <button onClick={()=>setView("list")}>Browse</button>
        </>
      )}

      {view === "donate" && <DonateForm onAdd={addFood}/>}
      {view === "list" && <Browse data={foodList} onClaim={claimFood}/>}
    </div>
  );
}

function Browse({data, onClaim}) {
  const [query,setQuery] = useState("");
  const [filter,setFilter] = useState("All");

  const filtered = data.filter(f=>{
    const matchSearch = f.name.toLowerCase().includes(query.toLowerCase());
    const matchFilter = filter==="All" || f.expiresInMin < 60;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      <input placeholder="search" value={query} onChange={e=>setQuery(e.target.value)}/>
      <div>
        <button onClick={()=>setFilter("All")}>All</button>
        <button onClick={()=>setFilter("Urgent")}>Urgent</button>
      </div>

      <div style={{height:100, background:"#333", margin:"10px 0"}}>
        Fake Map 📍
      </div>

      {filtered.map(f=>(
        <div key={f.id}>
          <p>{f.name}</p>
          <button onClick={()=>onClaim(f.id)}>Claim</button>
        </div>
      ))}
    </div>
  );
}

function DonateForm({onAdd}) {
  const [form,setForm] = useState({name:"",quantity:"",location:""});
  return (
    <div>
      <input placeholder="Food" onChange={e=>setForm({...form,name:e.target.value})}/>
      <input placeholder="Qty" onChange={e=>setForm({...form,quantity:e.target.value})}/>
      <input placeholder="Location" onChange={e=>setForm({...form,location:e.target.value})}/>
      <button onClick={()=>onAdd(form)}>Submit</button>
    </div>
  );
}
