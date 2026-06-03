import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function SmartKneeCapDashboard() {

  const espIP = "10.228.237.38";

  // =========================
  // STATES
  // =========================

  const [heatMode, setHeatMode] = useState("LOW");

  const [systemState, setSystemState] = useState("OFF");

  const [battery, setBattery] = useState(100);

  const [charging, setCharging] = useState("");

  const [espConnected, setEspConnected] = useState(false);

  const [page, setPage] = useState("dashboard");

  const [history, setHistory] = useState([]);

  const [loggedIn, setLoggedIn] = useState(
  localStorage.getItem("productID") === "SKC-001"
);

const [productId, setProductId] = useState("");
const [showScanner, setShowScanner] = useState(false);

useEffect(() => {

  if (!showScanner) return;

  const scanner = new Html5QrcodeScanner(
    "qr-reader",
    {
      fps: 10,
      qrbox: 250
    },
    false
  );

  scanner.render(
    (decodedText) => {

      if (
        decodedText.startsWith(
          "smartkneecap://"
        )
      ) {

        const scannedID =
          decodedText.replace(
            "smartkneecap://",
            ""
          );

        if (scannedID === "SKC-001") {

          localStorage.setItem(
            "productID",
            scannedID
          );

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

const [theme, setTheme] = useState(
  localStorage.getItem("theme") || "dark"
);
  // =========================
  // DEFAULT TEMPERATURES
  // =========================
const connectDevice = () => {

  if(productId !== "SKC-001"){

    alert("❌ Product ID Not Valid");

    return;

  }

  localStorage.setItem(
    "productID",
    "SKC-001"
  );

  setLoggedIn(true);

};

const disconnectDevice = () => {

  localStorage.removeItem(
    "productID"
  );

  setLoggedIn(false);

};

  const getDisplayTemp = () => {

    if(systemState === "OFF"){

      return "--";

    }

    if(heatMode === "LOW"){

      return 42;

    }

    if(heatMode === "MEDIUM"){

      return 45;

    }

    return 47;

  };

  // =========================
  // SEND COMMAND
  // =========================

  const sendCommand = async (cmd) => {

    try {

      await fetch(`http://${espIP}/${cmd}`);

      setTimeout(fetchStatus, 300);

    }

    catch(err){

      console.log(err);

      setEspConnected(false);

    }

  };

  // =========================
  // TOGGLE SYSTEM
  // =========================

  const toggleSystem = () => {

    if(systemState === "OFF"){

      sendCommand("on");

    }

    else{

      sendCommand("off");

    }

  };

  // =========================
  // HISTORY TRACKING
  // =========================

  const updateHistory = (newMode) => {

    const currentTime =
    new Date().toLocaleTimeString();

    setHistory((prev) => {

      if(prev.length === 0){

        return [{
          mode: newMode,
          start: currentTime,
          end: "Now"
        }];

      }

      const updated = [...prev];

      updated[0].end = currentTime;

      updated.unshift({
        mode: newMode,
        start: currentTime,
        end: "Now"
      });

      return updated.slice(0, 10);

    });

  };

  // =========================
  // FETCH STATUS
  // =========================

  const fetchStatus = async () => {

    try {

      const response =
      await fetch(`http://${espIP}/status`);

      if(!response.ok){

        throw new Error("ESP32 Offline");

      }

      const data = await response.text();

      const parts = data.split(",");

      const newSystem = parts[0];

      const newHeat = parts[1];

      const newBattery = parts[4];

      const newCharging = parts[5];

     
      if(newHeat !== heatMode){

        updateHistory(newHeat);

      }

      
      

      setSystemState(newSystem);

      setHeatMode(newHeat);

      setBattery(newBattery);

      setCharging(newCharging);

      setEspConnected(true);

    }

    catch(err){

      console.log(err);

      setEspConnected(false);

    }

  };

useEffect(() => {

  localStorage.setItem(
    "theme",
    theme
  );

}, [theme]);

  useEffect(() => {

    fetchStatus();

    const interval =
    setInterval(fetchStatus, 1000);

    return () => clearInterval(interval);

  }, [heatMode]);

 

  const isDisabled =
  systemState === "OFF";

 if(!loggedIn){

  return(

    <div className="min-h-screen bg-gradient-to-br from-[#06142b] via-[#0b1d47] to-[#1a0c3d] flex items-center justify-center">

      <div className="bg-[#08152f] p-10 rounded-3xl shadow-2xl w-[420px] text-white">

        <h1 className="text-4xl font-bold text-center mb-5">

          SMART KNEE CAP

        </h1>

        <p className="text-center text-cyan-300 mb-6">

          Enter Product ID

        </p>

        <input
          value={productId}
          onChange={(e)=>
            setProductId(
              e.target.value.toUpperCase()
            )
          }
          placeholder="SKC-001"
          className=" w-full
    p-4
    rounded-2xl
    bg-[#091224]
    border
    border-cyan-500/20
    text-white
    text-lg
    placeholder-gray-500
    focus:outline-none
    focus:border-cyan-400
    mb-6"
        />

        <button
          onClick={connectDevice}
          className="w-full bg-cyan-500 p-4 rounded-xl font-bold text-black"
        >

          CONNECT DEVICE

        </button>
<div className="mt-5 text-center">
<center>or</center>
  <button
  onClick={() =>
    setShowScanner(!showScanner)
  }
  className="
    mt-4
    w-full
    bg-[#0c1735]
    border
    border-cyan-500/30
    text-cyan-300
    font-semibold
    py-3
    rounded-2xl
    transition-all
    duration-300
    hover:bg-cyan-500
    hover:text-black
    hover:scale-105
    active:scale-95
    shadow-lg
  "
>
  📷 Scan Product QR
</button>

{showScanner && (

  <div
    id="qr-reader"
    className="mt-5"
  ></div>

)}

</div>
      </div>

    </div>

  );

}

  return (

    <div
  className={`min-h-screen p-6 ${
    theme === "dark"
      ? "bg-gradient-to-br from-[#06142b] via-[#0b1d47] to-[#1a0c3d] text-white"
      : "bg-gradient-to-br from-slate-100 via-white to-cyan-50 text-black"
  }`}
>

      <div className="max-w-7xl mx-auto">

        {/* HEADER */}

        <div
  className={`border border-cyan-500/20 rounded-3xl px-8 py-5 flex items-center justify-between ${
    theme === "dark"
      ? "bg-[#08152f]/90"
      : "bg-white shadow-xl"
  }`}
>
          {/* LEFT */}

          <div className="flex items-center gap-4">

            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-2xl transition-all duration-500 ${systemState === 'ON' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}>

              🦿

            </div>

            <div>

              <h1 className="text-3xl font-bold tracking-wide">
                SMART KNEE CAP
              </h1>

              <p className="text-cyan-300 tracking-[4px] text-sm">
                
                <p className="text-green-300 text-sm mt-1">

  Connected Device : SKC-001

</p>
              </p>

            </div>

          </div>

          {/* MENU */}

          <div className="flex gap-6 text-gray-300 font-medium">

            <button
              onClick={() => setPage("dashboard")}
              className="hover:text-cyan-300 transition-all duration-300 hover:scale-110"
            >
              Dashboard
            </button>

            <button
              onClick={() => setPage("history")}
              className="hover:text-cyan-300 transition-all duration-300 hover:scale-110"
            >
              History
            </button>

            <button
              onClick={() => setPage("about")}
              className="hover:text-cyan-300 transition-all duration-300 hover:scale-110"
            >
              About
            </button>

          </div>
<div className="flex gap-3">

  <button
    onClick={()=>
      setTheme(
        theme === "dark"
        ? "light"
        : "dark"
      )
    }
    className="px-4 py-2 rounded-xl bg-yellow-500 text-black font-bold"
  >

    {theme === "dark"
      ? "☀ Light"
      : "🌙 Dark"}

  </button>

  <button
    onClick={disconnectDevice}
    className="px-4 py-2 rounded-xl bg-red-500"
  >

    Log out

  </button>

</div>

          {/* ESP STATUS */}

          <div
            className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all duration-500 ${
              espConnected
              ? "bg-green-500/10 border-green-400/30 text-green-300 animate-pulse"
              : "bg-red-500/10 border-red-400/30 text-red-300"
            }`}
          >

            {espConnected
              ? "● ESP32 CONNECTED"
              : "● ESP32 NOT CONNECTED"}

          </div>

        </div>

        {/* DASHBOARD */}

        {page === "dashboard" && (

          <div className="grid lg:grid-cols-3 gap-6">

            {/* TEMPERATURE */}

            <div className="lg:col-span-2 bg-[#08152f]/90 border border-cyan-500/20 rounded-[35px] p-8 shadow-2xl relative overflow-hidden">

              <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>

              {/* TOP */}

              <div className="flex justify-between items-center mb-8 relative z-10">

                <div>

                  <p className="text-cyan-300 tracking-[4px] text-xs mb-2">
                    THERMAL CONTROL
                  </p>

                  <h2 className="text-4xl font-bold">
                    Temperature Control
                  </h2>

                </div>

                {/* TOGGLE */}

                <div className="flex items-center gap-4">

                  <span
                    className={`font-semibold tracking-[3px] ${
                      systemState === "ON"
                      ? "text-orange-300"
                      : "text-cyan-300"
                    }`}
                  >

                    {systemState === "ON"
                    ? "HOT MODE"
                    : "COLD MODE"}

                  </span>

                  <div
                    onClick={toggleSystem}
                    className={`w-28 h-14 rounded-full p-2 cursor-pointer transition-all duration-700 flex items-center shadow-2xl ${
                      systemState === "ON"
                      ? "bg-gradient-to-r from-orange-500 to-red-600 justify-end shadow-red-500/50"
                      : "bg-gradient-to-r from-cyan-400 to-blue-600 justify-start shadow-cyan-500/50"
                    }`}
                  >

                    <div
                      className={`w-10 h-10 rounded-full bg-white shadow-2xl transition-all duration-700 ${
                        systemState === "ON"
                        ? "animate-pulse"
                        : ""
                      }`}
                    ></div>

                  </div>

                </div>

              </div>

              {/* TEMP DISPLAY */}

              <div className="grid md:grid-cols-4 gap-5 items-center relative z-10">

                <div className="flex justify-center">

                  <div className={`w-48 h-48 rounded-full border-[10px] flex items-center justify-center transition-all duration-500 ${
                    isDisabled
                    ? 'border-gray-500 shadow-gray-500/30'
                    : heatMode === 'HIGH'
                    ? 'border-red-500 shadow-red-500/50 shadow-2xl animate-pulse'
                    : heatMode === 'MEDIUM'
                    ? 'border-yellow-400 shadow-yellow-400/40 shadow-2xl'
                    : 'border-cyan-400 shadow-cyan-400/30 shadow-2xl'
                  } bg-[#091224]`}>

                    <div className="text-center">

                      <h1 className={`text-6xl font-bold ${
                        isDisabled
                        ? 'text-gray-500'
                        : 'text-cyan-300 animate-bounce'
                      }`}>

                        {getDisplayTemp()}°

                      </h1>

                      <p className="text-gray-400 mt-2 tracking-[3px]">
                        TARGET TEMP
                      </p>

                    </div>

                  </div>

                </div>

                {/* HEAT MODES */}

                <div className="md:col-span-3 grid md:grid-cols-3 gap-4">

                  {/* LOW */}

                  <button
                    disabled={isDisabled}
                    onClick={() => sendCommand('low')}
                    className={`rounded-3xl p-6 text-center transition-all duration-500 ${
                      isDisabled
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : heatMode === 'LOW'
                      ? 'bg-cyan-400 text-black shadow-2xl shadow-cyan-400/40 animate-pulse hover:scale-110'
                      : 'bg-[#101f42] hover:scale-110'
                    }`}
                  >

                    <h3 className="text-2xl font-bold">
                      LOW
                    </h3>

                    <p className="mt-2">
                      42°C
                    </p>

                  </button>

                  {/* MEDIUM */}

                  <button
                    disabled={isDisabled}
                    onClick={() => sendCommand('medium')}
                    className={`rounded-3xl p-6 text-center transition-all duration-500 ${
                      isDisabled
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : heatMode === 'MEDIUM'
                      ? 'bg-yellow-400 text-black shadow-2xl shadow-yellow-400/40 animate-pulse hover:scale-110'
                      : 'bg-[#101f42] hover:scale-110'
                    }`}
                  >

                    <h3 className="text-2xl font-bold">
                      MEDIUM
                    </h3>

                    <p className="mt-2">
                      45°C
                    </p>

                  </button>

                  {/* HIGH */}

                  <button
                    disabled={isDisabled}
                    onClick={() => sendCommand('high')}
                    className={`rounded-3xl p-6 text-center transition-all duration-500 ${
                      isDisabled
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : heatMode === 'HIGH'
                      ? 'bg-red-500 text-white shadow-2xl shadow-red-500/40 animate-pulse hover:scale-110'
                      : 'bg-[#101f42] hover:scale-110'
                    }`}
                  >

                    <h3 className="text-2xl font-bold">
                      HIGH
                    </h3>

                    <p className="mt-2">
                      47°C
                    </p>

                  </button>

                </div>

              </div>

            </div>

            {/* BATTERY */}

            <div className="bg-[#08152f]/90 border border-cyan-500/20 rounded-[35px] p-8 shadow-2xl">

              <h2 className="text-3xl font-bold mb-8">
                Battery Monitor
              </h2>

              <div className={`rounded-3xl p-8 text-center mb-6 shadow-2xl transition-all duration-500 ${
                isDisabled
                ? 'bg-gray-700 text-gray-400'
                : 'bg-gradient-to-r from-cyan-400 to-teal-400 text-black shadow-cyan-500/30 hover:scale-105'
              }`}>

                <h1 className="text-7xl font-bold">
                  {battery}%
                </h1>

                {charging !== "" && (

                  <p className="text-xl mt-4 font-semibold animate-pulse">

                    ⚡ CHARGING

                  </p>

                )}

              </div>

            </div>

          </div>

        )}

        {/* HISTORY PAGE */}

        {page === "history" && (

          <div className="bg-[#08152f]/90 border border-cyan-500/20 rounded-[35px] p-8 shadow-2xl">

            <h2 className="text-4xl font-bold mb-8">
              Temperature Usage History
            </h2>

            <div className="space-y-4">

              {history.map((item, index) => (

                <div
                  key={index}
                  className="bg-[#0c1735] rounded-2xl p-5 border border-white/10"
                >

                  <div className="flex justify-between items-center">

                    <div>

                      <h3 className="text-2xl font-bold text-cyan-300">
                        {item.mode}
                      </h3>

                      <p className="text-gray-400 mt-2">
                        From {item.start} to {item.end}
                      </p>

                    </div>

                    <div className="text-4xl">

                      {item.mode === "LOW"
                      ? "❄️"
                      : item.mode === "MEDIUM"
                      ? "🌤️"
                      : "🔥"}

                    </div>

                  </div>

                </div>

              ))}

            </div>

          </div>

        )}

        {/* ABOUT PAGE */}

        {page === "about" && (

          <div className="bg-[#08152f]/90 border border-cyan-500/20 rounded-[35px] p-10 shadow-2xl">

  <h2 className="text-5xl font-bold mb-8">
    About Smart Knee Cap
  </h2>

  <div className="space-y-8 text-gray-300 leading-9 text-lg">

    <p>
      <strong>Smart Knee Cap</strong> is an intelligent wearable thermal
      therapy system designed to provide safe and effective heat therapy
      for knee pain relief, muscle relaxation, and rehabilitation support.
    </p>

    <p>
      The device combines advanced temperature control, battery monitoring,
      and wireless connectivity to deliver a comfortable and personalized
      therapy experience. Users can conveniently control heating levels
      through a web-based dashboard and monitor device status in real time.
    </p>

    <div>

      <h3 className="text-2xl font-bold text-cyan-300 mb-4">
        Key Features
      </h3>

      <ul className="space-y-2">

        <li>✅ Smart Temperature Control (Low, Medium, High)</li>

        <li>✅ Wireless ESP32-Based Connectivity</li>

        <li>✅ Real-Time Battery Monitoring</li>

        <li>✅ Safe Thermal Protection System</li>

        <li>✅ User-Friendly Web Dashboard</li>

        <li>✅ Product Authentication & Device Login</li>

        <li>✅ Rechargeable Battery Powered Operation</li>

      </ul>

    </div>

    <div>

      <h3 className="text-2xl font-bold text-cyan-300 mb-4">
        Therapy Modes
      </h3>

      <div className="space-y-4">

        <div>
          <strong>LOW MODE (42°C)</strong><br />
          Provides gentle warmth for daily comfort and extended usage.
        </div>

        <div>
          <strong>MEDIUM MODE (45°C)</strong><br />
          Suitable for muscle relaxation and moderate pain relief.
        </div>

        <div>
          <strong>HIGH MODE (47°C)</strong><br />
          Delivers intensive heat therapy for stiffness and recovery support.
        </div>

      </div>

    </div>

    <div>

      <h3 className="text-2xl font-bold text-cyan-300 mb-4">
        Technology Used
      </h3>

      <ul className="space-y-2">

        <li>• ESP32 Microcontroller</li>

        <li>• React.js Dashboard</li>

        <li>• Tailwind CSS</li>

        <li>• MOSFET Heating Control</li>

        <li>• Lithium  Battery Management</li>

        <li>• Real-Time Device Monitoring</li>

      </ul>

    </div>

    <div>

      <h3 className="text-2xl font-bold text-cyan-300 mb-4">
        Our Vision
      </h3>

      <p>
        Our goal is to make thermal therapy smarter, safer, and more
        accessible by integrating modern IoT technology with healthcare-focused
        wearable devices.
      </p>

    </div>

    <div className="mt-12 border-t border-cyan-500/20 pt-8">

      <h3 className="text-2xl font-bold text-center text-cyan-300 mb-8">
        Development Team
      </h3>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Hardware Developer */}

        <div className="bg-[#0c1735] border border-cyan-500/20 rounded-3xl p-6 hover:scale-105 transition-all duration-300 shadow-xl">

          <div className="text-4xl mb-3">⚡</div>

          <h4 className="text-xl font-bold text-white">
            Guhan
          </h4>

          <p className="text-cyan-300 mt-1">
            Hardware Developer
          </p>

          <div className="mt-4 space-y-2">

            <a
              href="mailto:Guhanguhan2528@gmail.com"
              className="block text-gray-400 hover:text-cyan-300 transition"
            >
              📧 guhanguhan2528@gmail.com
            </a>

            <a
              href="https://www.linkedin.com/in/guhan-v02/"
              target="_blank"
              rel="noreferrer"
              className="block text-gray-400 hover:text-cyan-300 transition"
            >
              💼 LinkedIn Profile
            </a>

          </div>

        </div>

        {/* Software Developer */}

        <div className="bg-[#0c1735] border border-cyan-500/20 rounded-3xl p-6 hover:scale-105 transition-all duration-300 shadow-xl">

          <div className="text-4xl mb-3">💻</div>

          <h4 className="text-xl font-bold text-white">
            Vijay
          </h4>

          <p className="text-cyan-300 mt-1">
            Software Developer
          </p>

          <div className="mt-4 space-y-2">

            <a
              href="mailto:vijaydukee2005@gmail.com"
              className="block text-gray-400 hover:text-cyan-300 transition"
            >
              📧 vijaydukee2005@gmail.com
            </a>

            <a
              href="https://linkedin.com/in/vijay-b-516b6932a/"
              target="_blank"
              rel="noreferrer"
              className="block text-gray-400 hover:text-cyan-300 transition"
            >
              💼 LinkedIn Profile
            </a>

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