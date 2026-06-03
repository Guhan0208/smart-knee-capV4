import { useEffect, useState } from "react";

export default function SmartKneeCapDashboard() {
  const productDatabase = {
    "SKC-001": "10.228.237.38",
  };

  const [connected, setConnected] = useState(false);
  const [productId, setProductId] = useState("");
  const [deviceIP, setDeviceIP] = useState("");

  const [heatMode, setHeatMode] = useState("LOW");
  const [systemState, setSystemState] = useState("OFF");
  const [battery, setBattery] = useState(100);
  const [charging, setCharging] = useState("");
  const [espConnected, setEspConnected] = useState(false);
  const [page, setPage] = useState("dashboard");

  const connectDevice = async () => {
    const ip = productDatabase[productId];
    if (!ip) return alert("Invalid Product ID");
    try {
      const r = await fetch(`http://${ip}/status`);
      if (r.ok) {
        setDeviceIP(ip);
        setConnected(true);
        localStorage.setItem("productID", productId);
      }
    } catch {
      alert("Device Not Found");
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("productID");
    if (saved && productDatabase[saved]) {
      setProductId(saved);
      setDeviceIP(productDatabase[saved]);
      setConnected(true);
    }
  }, []);

  if (!connected) {
    return (
      <div style={{padding:"40px"}}>
        <h1>SMART KNEE CAP</h1>
        <input value={productId} onChange={(e)=>setProductId(e.target.value.toUpperCase())} placeholder="SKC-001"/>
        <button onClick={connectDevice}>CONNECT DEVICE</button>
      </div>
    );
  }

  return (
    <div style={{padding:"20px"}}>
      <h1>SMART KNEE CAP</h1>
      <p>Connected Device: {productId}</p>
      <button onClick={()=>{
        localStorage.removeItem("productID");
        setConnected(false);
      }}>Disconnect</button>
      <hr/>
      <p>System: {systemState}</p>
      <p>Heat Mode: {heatMode}</p>
      <p>Battery: {battery}%</p>
      <p>{charging}</p>
      <p>Page: {page}</p>
      <p>IP: {deviceIP}</p>
      <p>Merge this login logic into your existing dashboard UI.</p>
    </div>
  );
}
