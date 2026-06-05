import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { db } from "./firebase";
import { ref, onValue, set } from "firebase/database";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function SmartKneeCapDashboard() {

  // =========================
  // STATES
  // =========================
  const [temperature, setTemperature] = useState(0);
  const [liveTemperature, setLiveTemperature] = useState(0);
  const [heater, setHeater] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState("offline");
  const [heatMode, setHeatMode] = useState("LOW");
  const [systemState, setSystemState] = useState("OFF");
  const [battery, setBattery] = useState(95);
  const [charging, setCharging] = useState("");
  const [page, setPage] = useState("dashboard");
  const [history, setHistory] = useState([]);
  const [loggedIn, setLoggedIn] = useState(
    localStorage.getItem("productID") === "SKC-001"
  );
  const [productId, setProductId] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "dark"
  );

  // References for tracking heartbeat changes across time boundaries
  const lastHeartbeatRef = useRef(0);
  const lastHeartbeatTimeRef = useRef(Date.now());

  // =========================
  // FIREBASE REAL-TIME SYNC & GLOBAL WATCHDOG
  // =========================
  useEffect(() => {
    if (!loggedIn) return;

    const deviceRef = ref(db, "devices/SKC-001");

    const unsubscribe = onValue(deviceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Target Temp Synchronization
        const newTargetTemp = data.temperature || 0;
        setTemperature(newTargetTemp);

        // Live Operational Thermocouple Temperature Processing & History Lifecycle logs
        const newLiveTemp = data.currentTemperature || 0;
        setLiveTemperature((prevTemp) => {
          if (newLiveTemp !== prevTemp && newLiveTemp > 0) {
            updateHistory(newLiveTemp);
          }
          return newLiveTemp;
        });

        // System Base Metrics
        setHeater(data.heater || false);
        setBattery(95);
        setCharging(data.charging || ""); // Handles charging status string if uploaded by ESP32
        
        if (data.mode) {
          setHeatMode(data.mode.toUpperCase());
        }

        if (data.heater) {
          setSystemState("ON");
        } else {
          setSystemState("OFF");
        }

        // Heartbeat Watchdog Interception Logic
        const currentHeartbeat = data.heartbeat || 0;
        if (currentHeartbeat !== lastHeartbeatRef.current) {
          lastHeartbeatRef.current = currentHeartbeat;
          lastHeartbeatTimeRef.current = Date.now();
          setDeviceStatus("online");
        }
      }
    });

    // Cloud Watchdog Evaluation Interval (Checks live sync state health every 2.5 seconds)
    const watchdogInterval = setInterval(() => {
      const timeElapsedSinceLastBeat = Date.now() - lastHeartbeatTimeRef.current;
      if (timeElapsedSinceLastBeat > 10000) {
        setDeviceStatus("offline");
      }
    }, 2500);

    return () => {
      unsubscribe();
      clearInterval(watchdogInterval);
    };
  }, [loggedIn]);

  // =========================
  // QR SCANNER EXTENSION
  // =========================
  useEffect(() => {
    if (!showScanner) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      (decodedText) => {
        if (decodedText.startsWith("smartkneecap://")) {
          const scannedID = decodedText.replace("smartkneecap://", "");

          if (scannedID === "SKC-001") {
            localStorage.setItem("productID", scannedID);
            setLoggedIn(true);
            setShowScanner(false);
            scanner.clear();
          } else {
            alert("Invalid Product");
          }
        }
      },
      () => {}
    );

    return () => {
      try {
        scanner.clear();
      } catch {}
    };
  }, [showScanner]);

  // =========================
  // HANDLERS & AUTHENTICATION
  // =========================
  const connectDevice = () => {
    if (productId !== "SKC-001") {
      alert("❌ Product ID Not Valid");
      return;
    }
    localStorage.setItem("productID", "SKC-001");
    setLoggedIn(true);
  };

  const disconnectDevice = () => {
    localStorage.removeItem("productID");
    setLoggedIn(false);
  };

  const sendCommand = async (cmd) => {
    // Prevent commands completely if the system is declared offline globally
    if (deviceStatus !== "online") return;

    try {
      let temp = 0;
      let heaterState = false;
      let mode = "LOW";

      if (cmd === "on") {
        heaterState = true;
        temp = temperature;
        if (heatMode === "LOW") { temp = 42; mode = "LOW"; }
        if (heatMode === "MEDIUM") { temp = 45; mode = "MEDIUM"; }
        if (heatMode === "HIGH") { temp = 47; mode = "HIGH"; }
      }
      if (cmd === "low") { temp = 42; heaterState = true; mode = "LOW"; }
      if (cmd === "medium") { temp = 45; heaterState = true; mode = "MEDIUM"; }
      if (cmd === "high") { temp = 47; heaterState = true; mode = "HIGH"; }
      if (cmd === "off") { temp = 0; heaterState = false; mode = "OFF"; }

      // Send instruction set up directly to the persistent device path
      await set(ref(db, "devices/SKC-001/heater"), heaterState);
      await set(ref(db, "devices/SKC-001/temperature"), temp);
      await set(ref(db, "devices/SKC-001/mode"), mode);
    } catch (err) {
      console.log("Firebase Cloud Send Failure: ", err);
    }
  };

  const toggleSystem = () => {
    if (deviceStatus !== "online") return;

    if (systemState === "OFF") {
      sendCommand("on");
    } else {
      sendCommand("off");
    }
  };

  const updateHistory = (newTemp) => {
    const currentTime = new Date().toLocaleTimeString();

    setHistory((prev) => {
      if (prev.length === 0) {
        return [{ tempVal: newTemp, start: currentTime, end: "Now" }];
      }
      const updated = [...prev];
      updated[0].end = currentTime;
      updated.unshift({ tempVal: newTemp, start: currentTime, end: "Now" });
      return updated.slice(0, 10);
    });
  };

  // =========================
  // PDF EXPORT REPORT GENERATOR
  // =========================
  const generatePDF = () => {
    if (history.length === 0) {
      alert("No data available to export yet!");
      return;
    }

    const doc = new jsPDF();
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.textColor = 6, 20, 43; 
    doc.text("SMART KNEE CAP", 14, 20);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.textColor = 100, 100, 100;
    doc.text("Monthly Usage & Therapy Diagnostics Report", 14, 28);

    doc.setFontSize(10);
    doc.text(`Device Signature ID: SKC-001`, 14, 38);
    doc.text(`Generated On: ${currentDate} at ${currentTime}`, 14, 44);
    doc.text(`Hardware Connection State at Download: ${deviceStatus.toUpperCase()}`, 14, 50);

    const tableRows = history.map((item, index) => [
      index + 1,
      `${item.tempVal}°C`,
      item.start,
      item.end,
    ]);

    autoTable(doc, {
      startY: 56,
      head: [["Cycle Index", "Logged Reading Temperature", "Session Trigger Start", "Session Concluded / State"]],
      body: tableRows,
      headStyles: { fillColor: [11, 29, 71], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 245, 255] },
      styles: { fontSize: 11, cellPadding: 5 },
    });

    doc.save(`SKC-001_Usage_Report_${currentDate.replace(/\//g, "-")}.pdf`);
  };

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  // =========================
  // LOGIN SCREEN (RESTORED QR SCANNER)
  // =========================
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#06142b] via-[#0b1d47] to-[#1a0c3d] flex items-center justify-center">
        <div className="bg-[#08152f] p-10 rounded-3xl shadow-2xl w-[420px] text-white">
          <h1 className="text-4xl font-bold text-center mb-5">SMART KNEE CAP</h1>
          <p className="text-center text-cyan-300 mb-6">Enter Product ID</p>
          <input
            value={productId}
            onChange={(e) => setProductId(e.target.value.toUpperCase())}
            placeholder="SKC-001"
            className="w-full p-4 rounded-2xl bg-[#091224] border border-cyan-500/20 text-white text-lg placeholder-gray-500 focus:outline-none focus:border-cyan-400 mb-6"
          />
          <button
            onClick={connectDevice}
            className="w-full bg-cyan-500 p-4 rounded-xl font-bold text-black tracking-wide hover:bg-cyan-400 transition-all"
          >
            CONNECT DEVICE
          </button>
          
          <div className="mt-5 text-center">
            <span className="text-gray-500">or</span>
            <button
              onClick={() => setShowScanner(!showScanner)}
              className="mt-4 w-full bg-[#0c1735] border border-cyan-500/30 text-cyan-300 font-semibold py-3 rounded-2xl transition-all duration-300 hover:bg-cyan-500 hover:text-black hover:scale-105 active:scale-95 shadow-lg"
            >
              📷 Scan Product QR
            </button>
            {showScanner && (
              <div id="qr-reader" className="mt-5 rounded-xl overflow-hidden border border-white/10"></div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // MAIN PANEL INTERFACE
  // =========================
  return (
    <div className={`min-h-screen p-6 ${theme === "dark" ? "bg-gradient-to-br from-[#06142b] via-[#0b1d47] to-[#1a0c3d] text-white" : "bg-gradient-to-br from-slate-100 via-white to-cyan-50 text-black"}`}>
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER BAR */}
        <div className={`border border-cyan-500/20 rounded-3xl px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4 ${theme === "dark" ? "bg-[#08152f]/90" : "bg-white shadow-xl"}`}>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-2xl transition-all duration-500 ${systemState === "ON" && deviceStatus === "online" ? "bg-green-500 animate-pulse" : "bg-gray-500"}`}>
              🦿
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-wide">SMART KNEE CAP</h1>
              <p className="text-cyan-300 tracking-[4px] text-sm">
                <span className="text-green-300 text-sm mt-1">Connected Device : SKC-001</span>
              </p>
            </div>
          </div>

          <div className="flex gap-6 font-medium">
            <button onClick={() => setPage("dashboard")} className={`transition-all duration-300 hover:scale-110 ${page === "dashboard" ? "text-cyan-400 font-bold" : "text-gray-400 hover:text-cyan-300"}`}>Dashboard</button>
            <button onClick={() => setPage("history")} className={`transition-all duration-300 hover:scale-110 ${page === "history" ? "text-cyan-400 font-bold" : "text-gray-400 hover:text-cyan-300"}`}>History</button>
            <button onClick={() => setPage("about")} className={`transition-all duration-300 hover:scale-110 ${page === "about" ? "text-cyan-400 font-bold" : "text-gray-400 hover:text-cyan-300"}`}>About</button>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="px-4 py-2 rounded-xl bg-yellow-500 text-black font-bold text-sm">
              {theme === "dark" ? "☀ Light" : "🌙 Dark"}
            </button>
            <button onClick={disconnectDevice} className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all">Log out</button>
            
            {/* ESP LIVE REALTIME CONNECTIVITY FLAG BADGE FROM GLOBAL CLOUD WATCHDOG */}
            <div className={`px-4 py-2 rounded-full border text-xs font-semibold tracking-wide transition-all duration-500 ${deviceStatus === "online" ? "bg-green-500/10 border-green-400/30 text-green-300 animate-pulse" : "bg-red-500/10 border-red-400/30 text-red-300"}`}>
              {deviceStatus === "online" ? "● ESP32 ONLINE (CLOUD)" : "● ESP32 OFFLINE (STALE)"}
            </div>
          </div>
        </div>

        {/* DASHBOARD TAB CONTAINER */}
        {page === "dashboard" && (
          <div className="grid lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2 bg-[#08152f]/90 border border-cyan-500/20 rounded-[35px] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
              <div className="flex justify-between items-center mb-8 relative z-10">
                <div>
                  <p className="text-cyan-300 tracking-[4px] text-xs mb-2">THERMAL CONTROL</p>
                  <h2 className="text-4xl font-bold">Temperature Control</h2>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-semibold tracking-[3px] ${systemState === "ON" ? "text-orange-300" : "text-cyan-300"}`}>{systemState === "ON" ? "HOT MODE" : "COLD MODE"}</span>
                  
                  {/* Toggle Slider Switch: Disabled unless deviceStatus is 'online' */}
                  <div 
                    onClick={toggleSystem} 
                    className={`w-28 h-14 rounded-full p-2 flex items-center shadow-2xl transition-all duration-700 ${deviceStatus !== "online" ? "bg-gray-700 opacity-40 cursor-not-allowed justify-start" : systemState === "ON" ? "bg-gradient-to-r from-orange-500 to-red-600 justify-end shadow-red-500/50 cursor-pointer" : "bg-gradient-to-r from-cyan-400 to-blue-600 justify-start shadow-cyan-500/50 cursor-pointer"}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-white shadow-2xl"></div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-5 items-center relative z-10">
                <div className="flex justify-center">
                  <div className={`w-48 h-48 rounded-full border-[10px] flex items-center justify-center transition-all duration-500 ${deviceStatus !== "online" ? "border-gray-600 opacity-50" : heatMode === "HIGH" ? "border-red-500 shadow-red-500/50 shadow-2xl animate-pulse" : heatMode === "MEDIUM" ? "border-yellow-400 shadow-yellow-400/40 shadow-2xl" : "border-cyan-400 shadow-cyan-400/30 shadow-2xl"} bg-[#091224]`}>
                    <div className="text-center">
                      <h1 className="text-5xl font-bold text-cyan-300 animate-bounce">
  {temperature > 0 ? `${temperature}°C` : "--°C"}
</h1>
                      
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3 grid md:grid-cols-3 gap-4">
                  {/* Mode Adjustment Buttons: Dynamic Cloud-Lock configurations */}
                  <button 
                    disabled={deviceStatus !== "online"}
                    onClick={() => sendCommand("low")} 
                    className={`rounded-3xl p-6 text-center transition-all duration-500 ${deviceStatus !== "online" ? "bg-[#101f42] opacity-30 cursor-not-allowed" : heatMode === "LOW" && systemState === "ON" ? "bg-cyan-400 text-black font-bold shadow-2xl" : "bg-[#101f42] hover:scale-110"}`}
                  >
                    <h3 className="text-2xl font-bold">LOW</h3>
                    <p className="mt-2">42°C</p>
                  </button>
                  <button 
                    disabled={deviceStatus !== "online"}
                    onClick={() => sendCommand("medium")} 
                    className={`rounded-3xl p-6 text-center transition-all duration-500 ${deviceStatus !== "online" ? "bg-[#101f42] opacity-30 cursor-not-allowed" : heatMode === "MEDIUM" && systemState === "ON" ? "bg-yellow-400 text-black font-bold shadow-2xl" : "bg-[#101f42] hover:scale-110"}`}
                  >
                    <h3 className="text-2xl font-bold">MEDIUM</h3>
                    <p className="mt-2">45°C</p>
                  </button>
                  <button 
                    disabled={deviceStatus !== "online"}
                    onClick={() => sendCommand("high")} 
                    className={`rounded-3xl p-6 text-center transition-all duration-500 ${deviceStatus !== "online" ? "bg-[#101f42] opacity-30 cursor-not-allowed" : heatMode === "HIGH" && systemState === "ON" ? "bg-red-500 text-white font-bold shadow-2xl animate-pulse" : "bg-[#101f42] hover:scale-110"}`}
                  >
                    <h3 className="text-2xl font-bold">HIGH</h3>
                    <p className="mt-2">47°C</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#08152f]/90 border border-cyan-500/20 rounded-[35px] p-8 shadow-2xl">
              <h2 className="text-3xl font-bold mb-8">Battery Monitor</h2>
              <div className="bg-gradient-to-r from-cyan-400 to-teal-400 text-black rounded-3xl p-8 text-center mb-6 shadow-2xl hover:scale-105 transition-all">
                <h1 className="text-7xl font-bold">{battery}%</h1>
                {charging !== "" && <p className="text-xl mt-4 font-semibold animate-pulse">⚡ CHARGING</p>}
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB WITH LIVE DATA + EXPORT GENERATOR */}
        {page === "history" && (
          <div className="bg-[#08152f]/90 border border-cyan-500/20 rounded-[35px] p-8 shadow-2xl mt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-4xl font-bold">Temperature Usage History</h2>
                <p className="text-gray-400 mt-1">Review operational therapy states tracked during runtime.</p>
              </div>
              <button
                onClick={generatePDF}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
              >
                📥 Download Monthly Report (PDF)
              </button>
            </div>

            <div className="space-y-4">
              {history.map((item, index) => (
                <div key={index} className="bg-[#0c1735] rounded-2xl p-5 border border-white/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-bold text-cyan-300">{item.tempVal}°C</h3>
                      <p className="text-gray-400 mt-2">From {item.start} to {item.end}</p>
                    </div>
                    <div className="text-4xl">
                      {item.tempVal <= 42 ? "❄️" : item.tempVal <= 45 ? "🌤️" : "🔥"}
                    </div>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-gray-500 text-center py-8">No usage log data cycles reported inside this live browser tracking session.</p>
              )}
            </div>
          </div>
        )}

        {/* ABOUT INSTRUCTIONAL TAB */}
        {page === "about" && (
          <div className="bg-[#08152f]/90 border border-cyan-500/20 rounded-[35px] p-10 shadow-2xl mt-6">
            <h2 className="text-5xl font-bold mb-8">About Smart Knee Cap</h2>
            <div className="space-y-8 text-gray-300 leading-9 text-lg">
              <p>
                <strong>Smart Knee Cap</strong> is an intelligent wearable thermal therapy system designed to provide safe and effective heat therapy for knee pain relief, muscle relaxation, and rehabilitation support.
              </p>
              <p>
                The device combines advanced temperature control, battery monitoring, and wireless connectivity to deliver a comfortable and personalized therapy experience. Users can conveniently control heating levels through a web-based dashboard and monitor device status in real time.
              </p>

              <div>
                <h3 className="text-2xl font-bold text-cyan-300 mb-4">Key Features</h3>
                <ul className="space-y-2 grid md:grid-cols-2">
                  <li>`✅ Smart Temperature Control (Low, Medium, High)`</li>
                  <li>`✅ Wireless ESP32-Based Connectivity`</li>
                  <li>`✅ Real-Time Battery Monitoring`</li>
                  <li>`✅ Safe Thermal Protection System`</li>
                  <li>`✅ User-Friendly Web Dashboard`</li>
                  <li>`✅ Product Authentication & Device Login`</li>
                  <li>`✅ Rechargeable Battery Powered Operation`</li>
                </ul>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-cyan-300 mb-4">Therapy Modes</h3>
                <div className="space-y-4">
                  <div><strong>LOW MODE (42°C)</strong><br />Provides gentle warmth for daily comfort and extended usage.</div>
                  <div><strong>MEDIUM MODE (45°C)</strong><br />Suitable for muscle relaxation and moderate pain relief.</div>
                  <div><strong>HIGH MODE (47°C)</strong><br />Delivers intensive heat therapy for stiffness and recovery support.</div>
                </div>
              </div>

              <div className="mt-12 border-t border-cyan-500/20 pt-8">
                <h3 className="text-2xl font-bold text-center text-cyan-300 mb-8">Development Team</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Guhan */}
                  <div className="bg-[#0c1735] border border-cyan-500/20 rounded-3xl p-6 hover:scale-105 transition-all duration-300 shadow-xl">
                    <div className="text-4xl mb-3">⚡</div>
                    <h4 className="text-xl font-bold text-white">Guhan</h4>
                    <p className="text-cyan-300 mt-1">Hardware Developer</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <a href="mailto:Guhanguhan2528@gmail.com" className="block text-gray-400 hover:text-cyan-300 transition">📧 guhanguhan2528@gmail.com</a>
                      <a href="https://www.linkedin.com/in/guhan-v02/" target="_blank" rel="noreferrer" className="block text-gray-400 hover:text-cyan-300 transition">💼 LinkedIn Profile</a>
                    </div>
                  </div>
                  {/* Vijay */}
                  <div className="bg-[#0c1735] border border-cyan-500/20 rounded-3xl p-6 hover:scale-105 transition-all duration-300 shadow-xl">
                    <div className="text-4xl mb-3">💻</div>
                    <h4 className="text-xl font-bold text-white">Vijay</h4>
                    <p className="text-cyan-300 mt-1">Software Developer</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <a href="mailto:vijaydukee2005@gmail.com" className="block text-gray-400 hover:text-cyan-300 transition">📧 vijaydukee2005@gmail.com</a>
                      <a href="https://linkedin.com/in/vijay-b-516b6932a/" target="_blank" rel="noreferrer" className="block text-gray-400 hover:text-cyan-300 transition">💼 LinkedIn Profile</a>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}