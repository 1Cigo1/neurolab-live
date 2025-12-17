import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import NeuralNetwork from './components/NeuralNetwork';
import { useBrain } from './useBrain'; 
import './App.css';
import io from 'socket.io-client';

// SOCKET BAĞLANTISI
const socket = io.connect("https://neurolab-server-xyz.onrender.com"); 

function App() {
  const [room, setRoom] = useState(""); 
  const [isJoined, setIsJoined] = useState(false);
  const [architecture, setArchitecture] = useState([2, 4, 4, 1]);
  const [learningRate, setLearningRate] = useState(0.03);
  const [manualInput, setManualInput] = useState([0, 0]); 

  const { weights, loss, isTraining, predictions, train } = useBrain(architecture);

  const inputs = ["0, 0", "0, 1", "1, 0", "1, 1"];
  const targets = [0, 1, 1, 0];

  useEffect(() => {
    socket.on("sync_architecture", (data) => {
      const cleanArchitecture = Array.isArray(data) ? data : data.architecture;
      if (cleanArchitecture && Array.isArray(cleanArchitecture)) {
        setArchitecture(cleanArchitecture);
      }
    });

    socket.on("sync_training_start", () => {
      console.log("Eğitim başlatıldı.");
    });

    return () => {
      socket.off("sync_architecture");
      socket.off("sync_training_start");
    };
  }, []);

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
          <p>GÜVENLİ BAĞLANTI GEREKLİ</p>
          <input 
            type="text" 
            placeholder="ODA NUMARASI GİRİN (Örn: 101)" 
            onChange={(event) => setRoom(event.target.value)}
            onKeyPress={(event) => { event.key === "Enter" && joinRoom() }}
          />
          <button onClick={joinRoom}>SUNUCUYA BAĞLAN</button>
        </div>
        <Canvas className="login-canvas">
          <color attach="background" args={['#101015']} />
          <Stars radius={50} count={2000} factor={4} fade />
          <ambientLight intensity={2} />
          <pointLight position={[10, 10, 10]} intensity={5} />
          <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} />
          <NeuralNetwork architecture={[2, 4, 2]} />
        </Canvas>
      </div>
    );
  }

  // --- ANA EKRAN ---
  return (
    // Arka plan rengini zifiri siyahtan (#000) koyu laciverte (#050b14) çektim.
    <div style={{ width: "100vw", height: "100vh", background: "#050b14" }}>
      
      <div className="ui-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>NEUROLAB v2.0</h3>
        </div>
        
        <div className="status-badge connected">
           ODA: <span style={{color: '#fff'}}>{room}</span> ● ÇEVRİMİÇİ
        </div>
        
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '4px', marginBottom: '15px', border: '1px solid #333' }}>
          
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#aaa', marginBottom:'5px' }}>
              <span>ÖĞRENME HIZI (LEARNING RATE)</span>
              <span style={{color:'var(--neon-blue)'}}>{learningRate}</span>
            </div>
            <input 
              type="range" min="0.001" max="0.5" step="0.01" 
              value={learningRate}
              onChange={(e) => setLearningRate(e.target.value)}
              disabled={isTraining}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          <button onClick={handleTrain} disabled={isTraining} style={{width: "100%", marginBottom: '15px'}}>
            {isTraining ? '>> EĞİTİM SÜRÜYOR...' : 'EĞİTİMİ BAŞLAT'}
          </button>

          <p className="info-text" style={{borderTop:'1px solid #333', paddingTop:'5px'}}>MANUEL TEST SİNYALİ</p>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button 
              onClick={() => setManualInput([manualInput[0] === 0 ? 1 : 0, manualInput[1]])}
              style={{ flex: 1, background: manualInput[0] ? 'var(--neon-green)' : 'transparent', color: manualInput[0] ? '#000' : '#888' }}
            >
              GİRİŞ A: {manualInput[0]}
            </button>
            <button 
              onClick={() => setManualInput([manualInput[0], manualInput[1] === 0 ? 1 : 0])}
              style={{ flex: 1, background: manualInput[1] ? 'var(--neon-green)' : 'transparent', color: manualInput[1] ? '#000' : '#888' }}
            >
              GİRİŞ B: {manualInput[1]}
            </button>
          </div>
          
          <div style={{ textAlign:'center', marginTop:'5px', fontSize:'10px', color:'#fff' }}>
            YAPAY ZEKA TAHMİNİ: <strong style={{color:'var(--neon-blue)', fontSize:'14px'}}>
              {(() => {
                const idx = (manualInput[0] * 2) + manualInput[1]; 
                return predictions[idx] ? predictions[idx].toFixed(4) : '---';
              })()}
            </strong>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>GİRİŞ</th>
              <th style={{textAlign:'center'}}>HEDEF</th>
              <th style={{textAlign:'right'}}>TAHMİN</th>
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
          <span className="info-text">HATA ORANI (LOSS)</span>
          <span style={{ fontSize: '14px', color: 'var(--neon-red)', fontWeight: 'bold' }}>
            {loss ? loss : '0.0000'}
          </span>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', margin: '15px 0' }}></div>
        <p className="info-text">MİMARİ (KATMANLAR)</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => updateArchitecture([2, ...architecture.slice(1, -1), 4, 1])} disabled={isTraining} style={{ flex: 1 }}>
            + KATMAN EKLE
          </button>
          <button className="btn-reset" onClick={() => updateArchitecture([2, 4, 1])} disabled={isTraining} style={{ flex: 1 }}>
            SIFIRLA
          </button>
        </div>
      </div>

      {/* --- AYDINLIK UZAY AYARLARI --- */}
      <Canvas camera={{ position: [0, 0, 120], fov: 60 }}> 
        
        {/* 1. Arka Plan Rengi: 3D Sahneye hafif gri ton ekler, böylece tam siyah olmaz */}
        <color attach="background" args={['#050b14']} />

        {/* 2. Ortam Işığı (Ambient): Bunu artırdık, gölgeleri yok eder */}
        <ambientLight intensity={5.0} /> 

        {/* 3. Atmosfer Işığı (Hemisphere): Yukarıdan beyaz, aşağıdan gri ışık verir. Çok doğaldır. */}
        <hemisphereLight skyColor="#ffffff" groundColor="#444444" intensity={2.0} />

        {/* 4. Noktasal Işıklar: Bunları devasa yaptık ve mesafesini artırdık */}
        <pointLight position={[100, 100, 100]} intensity={3.0} color="#ffffff" distance={1000} />
        <pointLight position={[-100, -100, -100]} intensity={3.0} color="#00aaff" distance={1000} />
        
        {/* 5. Yıldızlar: Sayısını ve parlaklığını artırdık */}
        <Stars radius={300} depth={100} count={10000} factor={15} saturation={0} fade />
        
        <NeuralNetwork 
          architecture={architecture} 
          weights={weights} 
          manualInput={manualInput} 
        />
        
        <OrbitControls 
          enablePan={true} 
          minDistance={10} 
          maxDistance={600} 
          autoRotate={true}
          autoRotateSpeed={0.5} 
        />
      </Canvas>
    </div>
  );
}

export default App;