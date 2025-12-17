import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import NeuralNetwork from './components/NeuralNetwork';
import { useBrain } from './useBrain'; 
import './App.css';
import io from 'socket.io-client';

// BURAYA DİKKAT: Render linkin veya localhost
const socket = io.connect("https://neurolab-server-xyz.onrender.com"); 

function App() {
  // --- STATE'LER ---
  const [room, setRoom] = useState(""); 
  const [isJoined, setIsJoined] = useState(false);
  const [architecture, setArchitecture] = useState([2, 4, 4, 1]);
  
  // YENİ EKLENEN STATE'LER
  const [learningRate, setLearningRate] = useState(0.03);
  const [manualInput, setManualInput] = useState([0, 0]); 

  const { weights, loss, isTraining, predictions, train } = useBrain(architecture);

  const inputs = ["0, 0", "0, 1", "1, 0", "1, 1"];
  const targets = [0, 1, 1, 0];

  // --- SOCKET DİNLEYİCİLERİ ---
  useEffect(() => {
    socket.on("sync_architecture", (data) => {
      // Gelen veriyi güvenli şekilde al (Dizi mi, obje mi?)
      const cleanArchitecture = Array.isArray(data) ? data : data.architecture;
      if (cleanArchitecture && Array.isArray(cleanArchitecture)) {
        setArchitecture(cleanArchitecture);
      }
    });

    socket.on("sync_training_start", () => {
      console.log("Odadaki başka bir admin eğitimi başlattı.");
    });

    return () => {
      socket.off("sync_architecture");
      socket.off("sync_training_start");
    };
  }, []);

  // --- FONKSİYONLAR ---
  const joinRoom = () => {
    if (room !== "") {
      socket.emit("join_room", room);
      setIsJoined(true);
    }
  };

  const updateArchitecture = (newArch) => {
    setArchitecture(newArch);
    socket.emit("sync_architecture", { room, architecture: newArch });
  };

  // EĞİTİMİ BAŞLATIRKEN ARTIK HIZI DA GÖNDERİYORUZ
  const handleTrain = () => {
    train(learningRate); 
    socket.emit("sync_training_start", room);
  };

  // --- GİRİŞ EKRANI ---
  if (!isJoined) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>NEUROLAB PORTAL</h1>
          <p>SECURE CONNECTION REQUIRED</p>
          <input 
            type="text" 
            placeholder="ENTER ROOM ID (e.g. 101)" 
            onChange={(event) => setRoom(event.target.value)}
            onKeyPress={(event) => { event.key === "Enter" && joinRoom() }}
          />
          <button onClick={joinRoom}>CONNECT TO SERVER</button>
        </div>
        <Canvas className="login-canvas">
          <Stars radius={50} count={2000} factor={4} fade />
          <ambientLight intensity={0.5} />
          <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} />
          <NeuralNetwork architecture={[2, 4, 2]} />
        </Canvas>
      </div>
    );
  }

  // --- ANA EKRAN ---
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#050505" }}>
      
      <div className="ui-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>NEUROLAB v2.0</h3>
        </div>
        
        <div className="status-badge connected">
           ROOM: <span style={{color: '#fff'}}>{room}</span> ● ONLINE
        </div>
        
        {/* --- YENİ EKLENEN KONTROL PANELİ (BAŞLANGIÇ) --- */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '4px', marginBottom: '15px', border: '1px solid #333' }}>
          
          {/* 1. ÖĞRENME HIZI (GAZ PEDALI) */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#aaa', marginBottom:'5px' }}>
              <span>LEARNING RATE</span>
              <span style={{color:'var(--neon-blue)'}}>{learningRate}</span>
            </div>
            <input 
              type="range" 
              min="0.001" 
              max="0.5" 
              step="0.01" 
              value={learningRate}
              onChange={(e) => setLearningRate(e.target.value)}
              disabled={isTraining}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* 2. ANA EĞİTİM BUTONU */}
          <button onClick={handleTrain} disabled={isTraining} style={{width: "100%", marginBottom: '15px'}}>
            {isTraining ? '>> TRAINING...' : 'START TRAINING'}
          </button>

          {/* 3. CANLI TEST (MANUEL GİRİŞ) */}
          <p className="info-text" style={{borderTop:'1px solid #333', paddingTop:'5px'}}>MANUAL TEST SIGNAL</p>
          <div style={{ display: 'flex', gap: '5px' }}>
            {/* GİRİŞ A BUTONU */}
            <button 
              onClick={() => setManualInput([manualInput[0] === 0 ? 1 : 0, manualInput[1]])}
              style={{ flex: 1, background: manualInput[0] ? 'var(--neon-green)' : 'transparent', color: manualInput[0] ? '#000' : '#888' }}
            >
              INPUT A: {manualInput[0]}
            </button>
            
            {/* GİRİŞ B BUTONU */}
            <button 
              onClick={() => setManualInput([manualInput[0], manualInput[1] === 0 ? 1 : 0])}
              style={{ flex: 1, background: manualInput[1] ? 'var(--neon-green)' : 'transparent', color: manualInput[1] ? '#000' : '#888' }}
            >
              INPUT B: {manualInput[1]}
            </button>
          </div>
          
          {/* MANUEL TEST SONUCU */}
          <div style={{ textAlign:'center', marginTop:'5px', fontSize:'10px', color:'#fff' }}>
            AI PREDICTION: <strong style={{color:'var(--neon-blue)', fontSize:'14px'}}>
              {(() => {
                const idx = (manualInput[0] * 2) + manualInput[1]; 
                return predictions[idx] ? predictions[idx].toFixed(4) : '---';
              })()}
            </strong>
          </div>

        </div>
        {/* --- YENİ EKLENEN KONTROL PANELİ (BİTİŞ) --- */}

        <table className="data-table">
          <thead>
            <tr>
              <th>INPUT</th>
              <th style={{textAlign:'center'}}>TARGET</th>
              <th style={{textAlign:'right'}}>PREDICTION</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map((inp, i) => {
              const val = predictions[i] || 0;
              const guess = predictions[i] ? val.toFixed(4) : '-----';
              const isCorrect = Math.abs(targets[i] - val) < 0.5;
              const color = isCorrect ? 'var(--neon-green)' : 'var(--neon-red)';
              return (
                <tr key={i}>
                  <td style={{fontFamily: 'monospace'}}>[{inp}]</td>
                  <td style={{textAlign:'center'}}>{targets[i]}</td>
                  <td style={{textAlign:'right', color: color, fontWeight: 'bold'}}>{guess}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <span className="info-text">LOSS</span>
          <span style={{ fontSize: '14px', color: 'var(--neon-red)', fontWeight: 'bold' }}>
            {loss ? loss : '0.0000'}
          </span>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', margin: '15px 0' }}></div>
        
        <p className="info-text">ARCHITECTURE</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => updateArchitecture([2, ...architecture.slice(1, -1), 4, 1])} disabled={isTraining} style={{ flex: 1 }}>
            + LAYER
          </button>
          <button className="btn-reset" onClick={() => updateArchitecture([2, 4, 1])} disabled={isTraining} style={{ flex: 1 }}>
            RESET
          </button>
        </div>
      </div>

      <Canvas camera={{ position: [0, 0, 16], fov: 50 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#00f3ff" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ff0055" />
        <Stars radius={100} depth={50} count={7000} factor={4} saturation={0} fade />
        
        {/* manualInput verisini de 3D ağa gönderiyoruz */}
        <NeuralNetwork 
          architecture={architecture} 
          weights={weights} 
          manualInput={manualInput} 
        />
        
        <OrbitControls enablePan={false} minDistance={5} maxDistance={30} />
      </Canvas>
    </div>
  );
}

export default App;