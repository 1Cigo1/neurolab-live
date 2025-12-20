import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import NeuralNetwork from './components/NeuralNetwork';
import { useBrain } from './useBrain'; 
import './App.css';
import io from 'socket.io-client';
import * as THREE from 'three';

// SOCKET LİNKİN (Render)
const socket = io.connect("https://neurolab-server-xyz.onrender.com"); 

const CHALLENGES = {
  XOR: { name: "GÖREV: XOR (ZOR)", targets: [0, 1, 1, 0] },
  AND: { name: "GÖREV: VE (AND)", targets: [0, 0, 0, 1] },
  OR:  { name: "GÖREV: VEYA (OR)", targets: [0, 1, 1, 1] }
};

// --- YENİ BİLEŞEN: DİĞER KULLANICILARIN İMLEÇLERİ (3D) ---
const RemoteCursors = ({ cursors }) => {
    return Object.entries(cursors).map(([userId, pos]) => (
        <group key={userId} position={pos}>
            {/* İmleç Işığı */}
            <mesh>
                <sphereGeometry args={[0.8, 16, 16]} />
                <meshBasicMaterial color="#ff00ff" />
            </mesh>
            {/* Kullanıcı Adı Etiketi */}
            <Html distanceFactor={15}>
                <div style={{
                    background: 'rgba(255, 0, 255, 0.5)', 
                    color: 'white', 
                    padding: '2px 5px', 
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap'
                }}>
                    User {userId.substr(0,4)}
                </div>
            </Html>
        </group>
    ));
};

// --- MOUSE TAKİPÇİSİ (Görünmez Düzlem) ---
const MouseTracker = ({ onMove }) => {
    // Uzayda görünmez bir duvar oluşturup mouse'un çarptığı yeri buluyoruz
    return (
        <mesh visible={false} onPointerMove={(e) => onMove(e.point)}>
            <planeGeometry args={[500, 500]} />
        </mesh>
    );
};


function App() {
  const [room, setRoom] = useState(""); 
  const [isJoined, setIsJoined] = useState(false);
  const [architecture, setArchitecture] = useState([2, 4, 4, 1]);
  const [learningRate, setLearningRate] = useState(0.03);
  const [manualInput, setManualInput] = useState([0, 0]); 
  const [deadNeurons, setDeadNeurons] = useState([]);
  
  const [currentChallenge, setCurrentChallenge] = useState("XOR"); 
  const [leaderboard, setLeaderboard] = useState({}); 

  const [systemLogs, setSystemLogs] = useState(["Sistem Hazır."]);
  const logsEndRef = useRef(null); 

  // --- YENİ STATE'LER ---
  const [remoteCursors, setRemoteCursors] = useState({}); // { 'socketId': [x,y,z] }
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  const architectureRef = useRef(architecture);
  const deadNeuronsRef = useRef(deadNeurons);

  useEffect(() => { architectureRef.current = architecture; }, [architecture]);
  useEffect(() => { deadNeuronsRef.current = deadNeurons; }, [deadNeurons]);

  const { weights, loss, isTraining, predictions, train } = useBrain(architecture);
  const inputs = ["0, 0", "0, 1", "1, 0", "1, 1"];
  const targets = CHALLENGES[currentChallenge].targets;

  const addLog = (msg) => {
    setSystemLogs(prev => [...prev.slice(-4), msg]); 
  };

  useEffect(() => { if(logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [systemLogs]);
  useEffect(() => { if(chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  useEffect(() => {
    socket.on("sync_architecture", (data) => {
      const cleanArchitecture = Array.isArray(data) ? data : data.architecture;
      if (cleanArchitecture && Array.isArray(cleanArchitecture)) setArchitecture(cleanArchitecture);
      addLog("📡 Mimari Senkronize Edildi.");
    });

    socket.on("sync_training_start", () => addLog("⚠️ Başka bir kullanıcı eğitimi başlattı."));
    socket.on("sync_dead_neurons", (list) => setDeadNeurons(list));

    socket.on("user_joined", () => {
        if (room) {
            socket.emit("sync_architecture", { room, architecture: architectureRef.current });
            socket.emit("sync_dead_neurons", { room, deadNeurons: deadNeuronsRef.current });
            addLog("👤 Odaya yeni kullanıcı katıldı.");
        }
    });

    socket.on("update_leaderboard", (data) => setLeaderboard(prev => ({ ...prev, [data.userId]: data.loss })));

    // --- YENİ SOCKET DİNLEYİCİLERİ ---
    socket.on("remote_cursor_move", (data) => {
        setRemoteCursors(prev => ({ ...prev, [data.userId]: data.position }));
    });

    socket.on("user_left", (data) => {
        setRemoteCursors(prev => {
            const newState = { ...prev };
            delete newState[data.userId];
            return newState;
        });
    });

    socket.on("receive_message", (data) => {
        setChatMessages(prev => [...prev, data]);
    });

    return () => {
      socket.off("sync_architecture");
      socket.off("sync_training_start");
      socket.off("sync_dead_neurons");
      socket.off("user_joined");
      socket.off("update_leaderboard");
      socket.off("remote_cursor_move");
      socket.off("user_left");
      socket.off("receive_message");
    };
  }, [room]);

  useEffect(() => {
    if (loss && room) {
        socket.emit("broadcast_loss", { room, loss, userId: socket.id });
        setLeaderboard(prev => ({ ...prev, "BEN": loss }));
    }
  }, [loss, room]);

  const joinRoom = () => { if (room !== "") { socket.emit("join_room", room); setIsJoined(true); } };

  const updateArchitecture = (newArch) => {
    setArchitecture(newArch); setDeadNeurons([]); 
    socket.emit("sync_architecture", { room, architecture: newArch });
    socket.emit("sync_dead_neurons", { room, deadNeurons: [] });
    addLog("🔧 Mimari güncellendi.");
  };

  const handleTrain = () => {
    train(learningRate, targets, addLog); 
    socket.emit("sync_training_start", room);
  };

  const toggleNeuronLife = (id) => {
    let newDeadList;
    if (deadNeurons.includes(id)) { newDeadList = deadNeurons.filter(d => d !== id); addLog(`💊 Nöron ${id} onarıldı.`); }
    else { newDeadList = [...deadNeurons, id]; addLog(`💀 SABOTAJ: Nöron ${id} devre dışı!`); }
    setDeadNeurons(newDeadList);
    socket.emit("sync_dead_neurons", { room, deadNeurons: newDeadList });
  };

  // 3D Alanda Mouse Hareketi
  const handleMouseMove = (point) => {
      if (room) {
          // Performans için her hareketi yollama (throttle yapılabilir ama şimdilik böyle kalsın)
          socket.emit("cursor_move", { room, position: [point.x, point.y, point.z] });
      }
  };

  const sendMessage = () => {
      if (chatInput.trim() !== "") {
          socket.emit("send_message", { room, text: chatInput });
          setChatInput("");
      }
  };

  if (!isJoined) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>NEUROLAB PORTAL</h1>
          <p>GÜVENLİ BAĞLANTI GEREKLİ</p>
          <input type="text" placeholder="ODA NO (Örn: 101)" onChange={(e) => setRoom(e.target.value)} onKeyPress={(e) => e.key === "Enter" && joinRoom()}/>
          <button onClick={joinRoom}>SUNUCUYA BAĞLAN</button>
        </div>
        <Canvas className="login-canvas">
          <color attach="background" args={['#101015']} />
          <Stars radius={50} count={2000} factor={4} fade />
          <ambientLight intensity={2} /><pointLight position={[10, 10, 10]} intensity={5} />
          <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} />
          <NeuralNetwork architecture={[2, 4, 2]} />
        </Canvas>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#050b14", position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* 1. ÜST BİLGİ ÇUBUĞU */}
      <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '40px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', zIndex: 10
      }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', letterSpacing: '2px', textShadow: '0 0 10px rgba(0,255,136,0.5)' }}>
            NEUROLAB <span style={{fontSize:'12px', color:'var(--neon-green)'}}>v2.0</span>
          </h3>
          <div className="status-badge connected" style={{fontSize: '11px', padding: '4px 10px', borderRadius:'12px'}}>
            ODA: <strong style={{color:'#fff'}}>{room}</strong> ● ÇEVRİMİÇİ
          </div>
      </div>

      {/* 2. 3D SAHNE */}
      <div style={{ flex: 1, position: 'relative' }}>
          <Canvas camera={{ position: [0, 0, 120], fov: 60 }}> 
            <color attach="background" args={['#050b14']} />
            <ambientLight intensity={5.0} /> 
            <hemisphereLight skyColor="#ffffff" groundColor="#444444" intensity={2.0} />
            <pointLight position={[100, 100, 100]} intensity={3.0} color="#ffffff" distance={1000} />
            <pointLight position={[-100, -100, -100]} intensity={3.0} color="#00aaff" distance={1000} />
            <Stars radius={300} depth={100} count={10000} factor={7} saturation={0} fade />
            
            {/* Mouse Hareketini Algılayan Görünmez Duvar */}
            <MouseTracker onMove={handleMouseMove} />
            
            {/* Diğer Kullanıcıların İmleçleri (Pembe Işıklar) */}
            <RemoteCursors cursors={remoteCursors} />

            <NeuralNetwork 
              architecture={architecture} 
              weights={weights} 
              manualInput={manualInput} 
              deadNeurons={deadNeurons}
              onNeuronClick={toggleNeuronLife}
            />
            
            <OrbitControls enablePan={true} minDistance={10} maxDistance={600} autoRotate={true} autoRotateSpeed={0.5} />
          </Canvas>

          {/* SİSTEM TERMİNALİ (Sol Üst) */}
          <div style={{ 
              position: 'absolute', top: '50px', left: '20px',
              background: 'rgba(0,0,0,0.6)', padding: '10px', borderRadius: '4px',
              borderLeft: '2px solid var(--neon-green)',
              fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#00ff88',
              maxWidth: '300px', pointerEvents: 'none'
          }}>
              {systemLogs.map((log, index) => (
                  <div key={index} style={{ opacity: (index + 2) / (systemLogs.length + 1) }}>{`> ${log}`}</div>
              ))}
              <div ref={logsEndRef} />
          </div>
      </div>

      {/* 3. KOKPİT PANELİ */}
      <div style={{
          height: '180px', 
          background: 'rgba(10, 15, 30, 0.85)',
          backdropFilter: 'blur(15px)',
          borderTop: '1px solid rgba(0, 255, 136, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '10px 20px',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
          zIndex: 20
      }}>
        
        {/* SOL: EĞİTİM */}
        <div style={{ width: '20%', display: 'flex', flexDirection: 'column', gap: '8px', borderRight:'1px solid rgba(255,255,255,0.1)', paddingRight:'15px' }}>
            <div style={{fontSize:'10px', color:'#aaa', fontWeight:'bold'}}>GÖREV & EĞİTİM</div>
            <select value={currentChallenge} onChange={(e) => setCurrentChallenge(e.target.value)} disabled={isTraining} style={{ width: '100%', padding: '6px', background: '#080808', color: 'var(--neon-green)', border: '1px solid #333', borderRadius: '4px', fontWeight: 'bold' }}>
                {Object.keys(CHALLENGES).map(key => (<option key={key} value={key}>{CHALLENGES[key].name}</option>))}
            </select>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#aaa' }}><span>HIZ: {learningRate}</span></div>
            <input type="range" min="0.001" max="0.5" step="0.01" value={learningRate} onChange={(e) => setLearningRate(e.target.value)} disabled={isTraining} style={{ width: '100%', height:'4px', accentColor:'var(--neon-blue)' }}/>
            <button onClick={handleTrain} disabled={isTraining} style={{ padding: '8px', fontSize: '12px', fontWeight: 'bold', background: isTraining ? '#333' : 'linear-gradient(90deg, var(--neon-blue) 0%, #0066ff 100%)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop:'auto' }}>
                {isTraining ? 'EĞİTİM SÜRÜYOR...' : '>> EĞİTİMİ BAŞLAT'}
            </button>
        </div>

        {/* ORTA: TABLO */}
        <div style={{ width: '25%', display: 'flex', gap: '15px', paddingLeft:'15px', borderRight:'1px solid rgba(255,255,255,0.1)', paddingRight:'15px' }}>
             <div style={{ flex: 1, overflowY:'auto' }}>
                <table className="data-table" style={{width:'100%', fontSize:'11px', borderCollapse:'collapse'}}>
                  <thead><tr style={{color:'#888', borderBottom:'1px solid #333'}}><th style={{textAlign:'left'}}>GİRİŞ</th><th style={{textAlign:'center'}}>HEDEF</th><th style={{textAlign:'right'}}>SONUÇ</th></tr></thead>
                  <tbody>{inputs.map((inp, i) => { const val = predictions[i] || 0; const isCorrect = Math.abs(targets[i] - val) < 0.5; return ( <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}><td style={{fontFamily: 'monospace', color:'#ccc'}}>[{inp}]</td><td style={{textAlign:'center', color:'#ccc'}}>{targets[i]}</td><td style={{textAlign:'right', color: isCorrect?'var(--neon-green)':'var(--neon-red)', fontWeight: 'bold'}}>{val?val.toFixed(4):'---'}</td></tr>)})}</tbody>
                </table>
            </div>
        </div>

        {/* SAĞ ORTA: SKOR & MİMARİ */}
        <div style={{ width: '25%', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft:'15px', borderRight:'1px solid rgba(255,255,255,0.1)', paddingRight:'15px' }}>
             <div style={{fontSize:'10px', color:'#aaa', fontWeight:'bold'}}>SKOR TABLOSU</div>
             <div style={{ flex:1, background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '4px', overflowY: 'auto' }}>
                {Object.entries(leaderboard).sort(([, a], [, b]) => parseFloat(a) - parseFloat(b)).map(([user, score]) => (
                    <div key={user} style={{ display: 'flex', justifyContent: 'space-between', fontSize:'11px', marginBottom:'2px' }}>
                        <span style={{ color: user === "BEN" ? '#fff' : '#888', fontWeight: user === "BEN" ? 'bold' : 'normal' }}>{user === "BEN" ? ">> SEN" : `Kullanıcı ${user.substr(0,4)}`}</span>
                        <span style={{ color: user === "BEN" ? 'var(--neon-green)' : '#aaa', fontFamily: 'monospace' }}>{score}</span>
                    </div>
                ))}
             </div>
             <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => updateArchitecture([2, ...architecture.slice(1, -1), 4, 1])} disabled={isTraining} style={{ flex: 1, padding:'4px', background:'rgba(255,255,255,0.1)', border:'1px solid #333', color:'#fff', borderRadius:'4px', cursor:'pointer', fontSize:'10px' }}>+ KATMAN</button>
                <button onClick={() => updateArchitecture([2, 4, 1])} disabled={isTraining} style={{ flex: 1, padding:'4px', background:'rgba(255,0,0,0.2)', border:'1px solid #333', color:'#fff', borderRadius:'4px', cursor:'pointer', fontSize:'10px' }}>SIFIRLA</button>
             </div>
        </div>

        {/* EN SAĞ: SOHBET (YENİ) */}
        <div style={{ width: '30%', display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft:'15px' }}>
            <div style={{fontSize:'10px', color:'#aaa', fontWeight:'bold'}}>TAKIM SOHBETİ</div>
            <div style={{ flex: 1, background:'rgba(0,0,0,0.6)', border:'1px solid #333', borderRadius:'4px', padding:'5px', overflowY:'auto', fontSize:'10px', fontFamily:'monospace' }}>
                {chatMessages.length === 0 ? <div style={{color:'#555', fontStyle:'italic'}}>Mesaj yok...</div> : null}
                {chatMessages.map((msg, idx) => (
                    <div key={idx} style={{ marginBottom:'4px' }}>
                        <span style={{color:'#888'}}> [{msg.time}] </span>
                        <span style={{color: msg.userId === socket.id ? 'var(--neon-blue)' : '#ff00ff' }}>
                             {msg.userId === socket.id ? 'SEN' : `User ${msg.userId.substr(0,3)}`}
                        </span>: <span style={{color:'#ddd'}}>{msg.text}</span>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <div style={{ display:'flex', gap:'5px' }}>
                <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Mesaj yaz..." 
                    style={{ flex:1, background:'#111', border:'1px solid #333', color:'#fff', fontSize:'11px', padding:'4px' }}
                />
                <button onClick={sendMessage} style={{ background:'var(--neon-green)', color:'#000', border:'none', padding:'0 10px', borderRadius:'2px', cursor:'pointer', fontWeight:'bold' }}>➔</button>
            </div>
        </div>

      </div>
    </div>
  );
}

export default App;