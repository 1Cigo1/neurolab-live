import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import NeuralNetwork from './components/NeuralNetwork';
import { useBrain } from './useBrain'; 
import './App.css';
import io from 'socket.io-client';
import * as THREE from 'three';

// ⚠️ KENDİ LİNKİNİ BURAYA YAZ!
const SOCKET_URL = "https://neurolab-live-server.onrender.com"; 

const socket = io.connect(SOCKET_URL); 

const CHALLENGES = {
  XOR: { name: "GÖREV: XOR (ZOR)", targets: [0, 1, 1, 0] },
  AND: { name: "GÖREV: VE (AND)", targets: [0, 0, 0, 1] },
  OR:  { name: "GÖREV: VEYA (OR)", targets: [0, 1, 1, 1] }
};

// --- İMLEÇLER ---
const RemoteCursors = ({ cursors }) => Object.entries(cursors).map(([userId, pos]) => (
    <group key={userId} position={pos}>
        <mesh><sphereGeometry args={[1.5, 16, 16]} /><meshBasicMaterial color="#ff00ff" /></mesh>
        <Html distanceFactor={25} position={[0, 3, 0]}><div style={{background:'rgba(255,0,255,0.8)', color:'white', padding:'2px 5px', borderRadius:'4px', fontSize:'10px'}}>User {userId.substr(0,4)}</div></Html>
    </group>
));

const MousePlane = ({ onMove }) => {
    const { camera, raycaster, mouse } = useThree();
    const planeRef = useRef();
    useFrame(() => {
        if (planeRef.current) {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(planeRef.current);
            if (intersects.length > 0) onMove(intersects[0].point);
        }
    });
    return <mesh ref={planeRef} visible={false}><planeGeometry args={[5000, 5000]} /></mesh>;
};

function App() {
  const [room, setRoom] = useState(""); 
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  const [architecture, setArchitecture] = useState([2, 4, 4, 1]);
  const [learningRate, setLearningRate] = useState(0.03);
  const [manualInput, setManualInput] = useState([0, 0]); 
  const [deadNeurons, setDeadNeurons] = useState([]);
  
  const [currentChallenge, setCurrentChallenge] = useState("XOR"); 
  const [leaderboard, setLeaderboard] = useState({}); 

  const [systemLogs, setSystemLogs] = useState(["Sistem Başlatılıyor..."]);
  const logsEndRef = useRef(null); 

  const [remoteCursors, setRemoteCursors] = useState({}); 
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  const architectureRef = useRef(architecture);
  const deadNeuronsRef = useRef(deadNeurons);
  const lossRef = useRef(null);

  useEffect(() => { architectureRef.current = architecture; }, [architecture]);
  useEffect(() => { deadNeuronsRef.current = deadNeurons; }, [deadNeurons]);

  const { weights, loss, isTraining, predictions, train } = useBrain(architecture);
  const inputs = ["0, 0", "0, 1", "1, 0", "1, 1"];
  const targets = CHALLENGES[currentChallenge].targets;

  // SKOR YAYINI (ÖNEMLİ FIX)
  useEffect(() => {
    lossRef.current = loss;
    if (room) {
        // loss null ise "Hazır" yolla, doluysa sayıyı yolla
        const valToSend = loss ? loss : "Hazır";
        socket.emit("broadcast_loss", { room, loss: valToSend, userId: socket.id });
    }
  }, [loss, room]);

  const addLog = (msg) => { setSystemLogs(prev => [...prev.slice(-4), msg]); };

  useEffect(() => { if(logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [systemLogs]);
  useEffect(() => { if(chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  useEffect(() => {
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("user_joined_alert", (data) => {
        addLog(`👤 User ${data.userId.substr(0,4)} geldi.`);
        if(socket.id !== data.userId) {
            socket.emit("sync_architecture", { room, architecture: architectureRef.current });
            socket.emit("sync_dead_neurons", { room, deadNeurons: deadNeuronsRef.current });
        }
        // Kendimizi anında listeye ekleyelim
        const myLoss = lossRef.current || "Hazır";
        socket.emit("broadcast_loss", { room, loss: myLoss, userId: socket.id });
    });

    socket.on("request_leaderboard_update", () => {
        const myLoss = lossRef.current || "Hazır";
        socket.emit("broadcast_loss", { room, loss: myLoss, userId: socket.id });
    });

    socket.on("update_leaderboard", (data) => {
        setLeaderboard(prev => ({ ...prev, [data.userId]: data.loss }));
    });

    socket.on("receive_message", (data) => {
        setChatMessages(prev => [...prev, data]);
    });

    socket.on("sync_architecture", (data) => setArchitecture(data));
    socket.on("sync_dead_neurons", (list) => setDeadNeurons(list));
    socket.on("sync_training_start", () => addLog("⚠️ Eğitim Başladı!"));
    socket.on("remote_cursor_move", (data) => setRemoteCursors(prev => ({ ...prev, [data.userId]: data.position })));
    socket.on("user_left", (data) => {
        setRemoteCursors(prev => { const n={...prev}; delete n[data.userId]; return n; });
        setLeaderboard(prev => { const n={...prev}; delete n[data.userId]; return n; });
        addLog("👤 Biri ayrıldı.");
    });

    return () => {
        socket.off("receive_message"); socket.off("update_leaderboard"); 
        socket.off("user_joined_alert"); socket.off("request_leaderboard_update");
        socket.off("remote_cursor_move");
    };
  }, [room]);

  const joinRoom = () => { 
      if (room.trim() !== "") { 
          socket.emit("join_room", room.trim()); 
          setIsJoined(true); 
          // Anında kendini listeye ekle
          setLeaderboard(prev => ({ ...prev, [socket.id]: "Hazır" }));
      } 
  };

  const updateArchitecture = (newArch) => {
    setArchitecture(newArch); setDeadNeurons([]); 
    socket.emit("sync_architecture", { room, architecture: newArch });
    socket.emit("sync_dead_neurons", { room, deadNeurons: [] });
    addLog("🔧 Mimari güncellendi.");
  };

  const handleTrain = () => { train(learningRate, targets, addLog); socket.emit("sync_training_start", room); };

  const toggleNeuronLife = (id) => {
    let newDeadList;
    if (deadNeurons.includes(id)) { newDeadList = deadNeurons.filter(d => d !== id); addLog(`💊 Nöron ${id} onarıldı.`); }
    else { newDeadList = [...deadNeurons, id]; addLog(`💀 SABOTAJ: Nöron ${id} devre dışı!`); }
    setDeadNeurons(newDeadList);
    socket.emit("sync_dead_neurons", { room, deadNeurons: newDeadList });
  };

  const handleMouseMove = (point) => { if (room) socket.emit("cursor_move", { room, position: [point.x, point.y, point.z] }); };
  const sendMessage = () => { if (chatInput.trim() !== "") { socket.emit("send_message", { room, text: chatInput }); setChatInput(""); } };

  if (!isJoined) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>NEUROLAB PORTAL</h1>
          <div style={{ color: isConnected ? '#00ff88' : '#ff0055', fontWeight: 'bold', marginBottom: '10px', border: '1px solid', padding:'5px', borderRadius:'4px' }}>
             {isConnected ? "✅ SUNUCUYA BAĞLI" : "❌ BAĞLANTI YOK (Linkini Kontrol Et)"}
          </div>
          <input type="text" placeholder="ODA NO (Örn: 101)" onChange={(e) => setRoom(e.target.value)} onKeyPress={(e) => e.key === "Enter" && joinRoom()}/>
          <button onClick={joinRoom} disabled={!isConnected}>SUNUCUYA BAĞLAN</button>
        </div>
        <Canvas className="login-canvas"><color attach="background" args={['#101015']} /><Stars radius={50} count={2000} factor={4} fade /><ambientLight intensity={2} /><OrbitControls autoRotate enableZoom={false} /><NeuralNetwork architecture={[2, 4, 2]} /></Canvas>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#050b14", position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* ÜST BAR */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', zIndex: 10 }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', letterSpacing: '2px', textShadow: '0 0 10px rgba(0,255,136,0.5)' }}>NEUROLAB <span style={{fontSize:'12px', color:'var(--neon-green)'}}>v2.0</span></h3>
          <div className="status-badge connected" style={{fontSize: '11px', padding: '4px 10px', borderRadius:'12px', background: isConnected ? 'rgba(0,255,136,0.1)' : 'rgba(255,0,0,0.2)', border: isConnected ? '1px solid var(--neon-green)' : '1px solid red'}}>ODA: {room} ● {isConnected ? "ONLINE" : "OFFLINE"}</div>
      </div>

      {/* 3D SAHNE */}
      <div style={{ flex: 1, position: 'relative' }}>
          <Canvas camera={{ position: [0, 0, 120], fov: 60 }}> 
            <color attach="background" args={['#050b14']} />
            <ambientLight intensity={5.0} /> 
            <hemisphereLight skyColor="#ffffff" groundColor="#444444" intensity={2.0} />
            <pointLight position={[100, 100, 100]} intensity={3.0} />
            <pointLight position={[-100, -100, -100]} intensity={3.0} color="#00aaff" />
            <Stars radius={300} depth={100} count={10000} factor={7} saturation={0} fade />
            <MousePlane onMove={handleMouseMove} />
            <RemoteCursors cursors={remoteCursors} />
            <NeuralNetwork architecture={architecture} weights={weights} manualInput={manualInput} deadNeurons={deadNeurons} onNeuronClick={toggleNeuronLife} />
            <OrbitControls enablePan={true} minDistance={10} maxDistance={600} autoRotate={true} autoRotateSpeed={0.5} />
          </Canvas>
          <div style={{ position: 'absolute', top: '50px', left: '20px', background: 'rgba(0,0,0,0.6)', padding: '10px', borderRadius: '4px', borderLeft: '2px solid var(--neon-green)', fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#00ff88', maxWidth: '300px', pointerEvents: 'none' }}>
              {systemLogs.map((log, index) => (<div key={index} style={{ opacity: (index + 2) / (systemLogs.length + 1) }}>{`> ${log}`}</div>))}
              <div ref={logsEndRef} />
          </div>
      </div>

      {/* ALT PANEL */}
      <div style={{ height: '240px', background: 'rgba(10, 15, 30, 0.95)', backdropFilter: 'blur(15px)', borderTop: '1px solid rgba(0, 255, 136, 0.3)', display: 'flex', justifyContent: 'space-between', padding: '15px 20px', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', zIndex: 20 }}>
        
        {/* SOL: EĞİTİM */}
        <div style={{ width: '20%', display: 'flex', flexDirection: 'column', gap: '10px', borderRight:'1px solid rgba(255,255,255,0.1)', paddingRight:'15px' }}>
            <div style={{fontSize:'12px', color:'#aaa', fontWeight:'bold'}}>GÖREV & EĞİTİM</div>
            <select value={currentChallenge} onChange={(e) => setCurrentChallenge(e.target.value)} disabled={isTraining} style={{ width: '100%', padding: '8px', background: '#080808', color: 'var(--neon-green)', border: '1px solid #333', borderRadius: '4px', fontWeight: 'bold' }}>{Object.keys(CHALLENGES).map(key => (<option key={key} value={key}>{CHALLENGES[key].name}</option>))}</select>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#aaa' }}><span>HIZ: {learningRate}</span></div>
            <input type="range" min="0.001" max="0.5" step="0.01" value={learningRate} onChange={(e) => setLearningRate(e.target.value)} disabled={isTraining} style={{ width: '100%', height:'4px', accentColor:'var(--neon-blue)' }}/>
            <button onClick={handleTrain} disabled={isTraining} style={{ padding: '10px', fontSize: '12px', fontWeight: 'bold', background: isTraining ? '#333' : 'linear-gradient(90deg, var(--neon-blue) 0%, #0066ff 100%)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop:'auto' }}>{isTraining ? 'EĞİTİM SÜRÜYOR...' : '>> EĞİTİMİ BAŞLAT'}</button>
        </div>

        {/* ORTA: VERİLER */}
        <div style={{ width: '35%', display: 'flex', gap: '15px', paddingLeft:'15px', borderRight:'1px solid rgba(255,255,255,0.1)', paddingRight:'15px' }}>
            <div style={{ flex: 2, overflowY:'auto' }}>
                <table className="data-table" style={{width:'100%', fontSize:'11px', borderCollapse:'collapse'}}><thead><tr style={{color:'#888', borderBottom:'1px solid #333'}}><th style={{textAlign:'left'}}>GİRİŞ</th><th style={{textAlign:'center'}}>HEDEF</th><th style={{textAlign:'right'}}>SONUÇ</th></tr></thead><tbody>{inputs.map((inp, i) => { const val = predictions[i] || 0; const isCorrect = Math.abs(targets[i] - val) < 0.5; return ( <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}><td style={{fontFamily: 'monospace', color:'#ccc'}}>[{inp}]</td><td style={{textAlign:'center', color:'#ccc'}}>{targets[i]}</td><td style={{textAlign:'right', color: isCorrect?'var(--neon-green)':'var(--neon-red)', fontWeight: 'bold'}}>{val?val.toFixed(4):'---'}</td></tr>)})}</tbody></table>
            </div>
            <div style={{ flex: 1, display:'flex', flexDirection:'column', gap:'5px' }}>
                <div style={{fontSize:'12px', color:'#aaa', fontWeight:'bold', textAlign:'center'}}>MANUEL</div>
                <button onClick={() => setManualInput([manualInput[0]===0?1:0, manualInput[1]])} style={{ padding:'8px', background: manualInput[0] ? 'var(--neon-green)' : 'rgba(255,255,255,0.1)', color: manualInput[0]?'#000':'#ccc', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'10px' }}>GİRİŞ A</button>
                <button onClick={() => setManualInput([manualInput[0], manualInput[1]===0?1:0])} style={{ padding:'8px', background: manualInput[1] ? 'var(--neon-green)' : 'rgba(255,255,255,0.1)', color: manualInput[1]?'#000':'#ccc', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'10px' }}>GİRİŞ B</button>
                <div style={{ textAlign:'center', marginTop:'auto', background:'#000', padding:'5px', borderRadius:'4px' }}><div style={{fontSize:'9px', color:'#888'}}>TAHMİN</div><strong style={{color:'var(--neon-blue)', fontSize:'16px'}}>{(() => { const idx = (manualInput[0] * 2) + manualInput[1]; return predictions[idx] ? predictions[idx].toFixed(4) : '---'; })()}</strong></div>
            </div>
        </div>

        {/* SAĞ: SKOR & MİMARİ */}
        <div style={{ width: '20%', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft:'15px', borderRight:'1px solid rgba(255,255,255,0.1)', paddingRight:'15px' }}>
             <div style={{fontSize:'12px', color:'#aaa', fontWeight:'bold'}}>SKOR TABLOSU</div>
             <div style={{ flex:1, background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '4px', overflowY: 'auto' }}>
                {Object.keys(leaderboard).length === 0 ? <div style={{fontSize:'10px', color:'#666'}}>Veri bekleniyor...</div> : null}
                {Object.entries(leaderboard).sort(([, a], [, b]) => {
                     // "Hazır" yazanları en alta, sayıları en üste (küçükten büyüğe)
                     const numA = parseFloat(a); const numB = parseFloat(b);
                     if (isNaN(numA)) return 1; if (isNaN(numB)) return -1;
                     return numA - numB;
                }).map(([user, score]) => (
                    <div key={user} style={{ display: 'flex', justifyContent: 'space-between', fontSize:'11px', marginBottom:'2px' }}>
                        <span style={{ color: user === socket.id ? '#fff' : '#888', fontWeight: user === socket.id ? 'bold' : 'normal' }}>
                            {user === socket.id ? "User BEN" : `User ${user.substr(0,4)}`}
                        </span>
                        <span style={{ color: user === socket.id ? 'var(--neon-green)' : '#aaa', fontFamily: 'monospace' }}>
                            {score}
                        </span>
                    </div>
                ))}
             </div>
             <div style={{ display: 'flex', gap: '5px' }}><button onClick={() => updateArchitecture([2, ...architecture.slice(1, -1), 4, 1])} disabled={isTraining} style={{ flex: 1, padding:'4px', background:'rgba(255,255,255,0.1)', border:'1px solid #333', color:'#fff', borderRadius:'4px', cursor:'pointer', fontSize:'10px' }}>+ KATMAN</button><button onClick={() => updateArchitecture([2, 4, 1])} disabled={isTraining} style={{ flex: 1, padding:'4px', background:'rgba(255,0,0,0.2)', border:'1px solid #333', color:'#fff', borderRadius:'4px', cursor:'pointer', fontSize:'10px' }}>SIFIRLA</button></div>
        </div>

        {/* EN SAĞ: WHATSAPP SOHBETİ */}
        <div style={{ width: '25%', display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft:'15px' }}>
            <div style={{fontSize:'12px', color:'#aaa', fontWeight:'bold'}}>TAKIM SOHBETİ</div>
            <div style={{ flex: 1, background:'rgba(0,0,0,0.2)', border:'1px solid #333', borderRadius:'4px', padding:'10px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px' }}>
                {chatMessages.length === 0 ? <div style={{color:'#555', fontStyle:'italic', padding:'5px', textAlign:'center'}}>Henüz mesaj yok...</div> : null}
                {chatMessages.map((msg, idx) => {
                    const isMe = msg.userId === socket.id;
                    return (
                        <div key={idx} style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            background: isMe ? '#005c4b' : '#202c33', // WhatsApp Yeşili & Grisi
                            color: '#e9edef',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            borderTopRightRadius: isMe ? '0px' : '8px',
                            borderTopLeftRadius: isMe ? '8px' : '0px',
                            maxWidth: '85%',
                            fontSize: '12px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            position: 'relative',
                            fontFamily: 'sans-serif'
                        }}>
                            {!isMe && <div style={{fontSize:'9px', color:'#00ff88', marginBottom:'2px', fontWeight:'bold'}}>User {msg.userId.substr(0,4)}</div>}
                            <div style={{wordBreak: 'break-word'}}>{msg.text}</div>
                            <div style={{fontSize:'9px', color:'rgba(255,255,255,0.6)', textAlign:'right', marginTop:'2px', marginLeft:'10px'}}>{msg.time}</div>
                        </div>
                    );
                })}
                <div ref={chatEndRef} />
            </div>
            <div style={{ display:'flex', gap:'5px', marginTop:'auto' }}>
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Mesaj yaz..." style={{ flex:1, background:'#202c33', border:'none', color:'#fff', fontSize:'12px', padding:'10px', borderRadius:'20px', paddingLeft:'15px' }}/>
                <button onClick={sendMessage} style={{ background:'#00a884', color:'#fff', border:'none', width:'35px', height:'35px', borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold' }}>➔</button>
            </div>
        </div>

      </div>
    </div>
  );
}

export default App;