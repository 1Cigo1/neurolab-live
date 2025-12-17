import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import NeuralNetwork from './components/NeuralNetwork';
import { useBrain } from './useBrain'; 
import './App.css';
import io from 'socket.io-client';

const socket = io.connect("http://localhost:3001");

function App() {
  // --- STATE'LER ---
  const [room, setRoom] = useState(""); // Oda ismi
  const [isJoined, setIsJoined] = useState(false); // Odaya girdi mi?
  const [architecture, setArchitecture] = useState([2, 4, 4, 1]);
  
  const { weights, loss, isTraining, predictions, train } = useBrain(architecture);

  const inputs = ["0, 0", "0, 1", "1, 0", "1, 1"];
  const targets = [0, 1, 1, 0];

  // --- SOCKET DİNLEYİCİLERİ ---
  useEffect(() => {
    socket.on("sync_architecture", (newArch) => {
      setArchitecture(newArch);
    });
    socket.on("sync_training_start", () => {
      // Başkası eğitimi başlatınca bizde de otomatik başlasın istersen:
      // train(); komutunu buraya ekleyebilirsin ama sonsuz döngüye dikkat.
      // Şimdilik sadece log düşelim.
      console.log("Odadaki başka bir admin eğitimi başlattı.");
    });
    return () => {
      socket.off("sync_architecture");
      socket.off("sync_training_start");
    };
  }, []);

  // --- ODAYA KATILMA ---
  const joinRoom = () => {
    if (room !== "") {
      socket.emit("join_room", room);
      setIsJoined(true); // Giriş ekranını kapat, ana ekranı aç
    }
  };

  // --- VERİ GÖNDERME ---
  const updateArchitecture = (newArch) => {
    setArchitecture(newArch);
    // Artık veriyi gönderirken ODA BİLGİSİNİ de ekliyoruz
    socket.emit("sync_architecture", { room, architecture: newArch });
  };

  const handleTrain = () => {
    train();
    socket.emit("sync_training_start", room);
  };

  // --- GİRİŞ EKRANI (LOGIN SCREEN) ---
  if (!isJoined) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1 className="glitch-text">NEUROLAB PORTAL</h1>
          <p>SECURE CONNECTION REQUIRED</p>
          
          <input 
            type="text" 
            placeholder="ENTER ROOM ID (e.g. 101)" 
            onChange={(event) => setRoom(event.target.value)}
            onKeyPress={(event) => { event.key === "Enter" && joinRoom() }}
          />
          
          <button onClick={joinRoom}>CONNECT TO SERVER</button>
        </div>
        
        {/* Arka planda hafif bir 3D animasyon dönsün */}
        <Canvas className="login-canvas">
          <Stars radius={50} count={2000} factor={4} fade />
          <ambientLight intensity={0.5} />
          <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} />
          <NeuralNetwork architecture={[2, 4, 2]} />
        </Canvas>
      </div>
    );
  }

  // --- ANA UYGULAMA (MAIN APP) ---
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#050505" }}>
      
      <div className="ui-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>NEUROLAB v2.0</h3>
        </div>
        
        {/* Oda Bilgisi Göstergesi */}
        <div className="status-badge connected">
           ROOM: <span style={{color: '#fff'}}>{room}</span> ● ONLINE
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <button onClick={handleTrain} disabled={isTraining} style={{width: "100%"}}>
            {isTraining ? '>> PROCESSING...' : 'START TRAINING'}
          </button>
        </div>

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
                  <td style={{textAlign:'right', color: color, fontWeight: 'bold'}}>
                    {guess}
                  </td>
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
        <NeuralNetwork architecture={architecture} weights={weights} />
        <OrbitControls enablePan={false} minDistance={5} maxDistance={30} />
      </Canvas>
    </div>
  );
}

export default App;