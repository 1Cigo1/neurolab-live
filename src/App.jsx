import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import NeuralNetwork from './components/NeuralNetwork';
import './App.css';
import io from 'socket.io-client';

// ⚠️ BURAYA KENDİ RENDER LİNKİNİ YAPIŞTIR!
// Örnek: "https://neurolab-server-benimki.onrender.com"
const SOCKET_URL = "https://neurolab-live-server.onrender.com"; 

const socket = io.connect(SOCKET_URL); 

// ... (Geri kalan kodların hepsi AYNI, sadece yukarıdaki linki değiştirmen yeterli)
// ... Kodun geri kalanını silmene gerek yok, sadece üstteki SOCKET_URL satırını güncelle.

const CLASSES = {
    STRIKER: { name: "SALDIRGAN", hp: 100, atk: 25, def: 0, color: "#ff0055", icon: "⚔️", desc: "Yüksek Hasar" },
    TANK:    { name: "KALKAN",    hp: 200, atk: 10, def: 30, color: "#ffff00", icon: "🛡️", desc: "Yüksek Defans" },
    HACKER:  { name: "HACKER",    hp: 120, atk: 15, def: 10, color: "#00ff88", icon: "💻", desc: "Hızlı Kaynak" } 
};

// --- YARDIMCI BİLEŞENLER ---
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
    return <mesh ref={planeRef} visible={false}><planeGeometry args={[10000, 10000]} /></mesh>;
};

const RemoteCursors = ({ cursors }) => Object.entries(cursors).map(([userId, pos]) => (
    <group key={userId} position={pos}>
        <mesh><sphereGeometry args={[2, 16, 16]} /><meshBasicMaterial color="#ff00ff" /></mesh>
        <Html distanceFactor={40} position={[0, 4, 0]}><div style={{background:'rgba(255,0,255,0.6)', color:'#fff', padding:'2px', borderRadius:'4px', fontSize:'10px', fontWeight:'bold', border:'1px solid #ff00ff'}}>DÜŞMAN</div></Html>
    </group>
));

function App() {
  const [room, setRoom] = useState(""); 
  const [selectedClass, setSelectedClass] = useState("STRIKER");
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);

  // İstatistikler
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [shield, setShield] = useState(0);
  const [resources, setResources] = useState(0);
  const [aiLevel, setAiLevel] = useState(1);
  const [isDead, setIsDead] = useState(false);

  // Efektler
  const [isUnderAttack, setIsUnderAttack] = useState(false);
  const [attackCooldown, setAttackCooldown] = useState(false);
  const [players, setPlayers] = useState({}); 
  const [remoteCursors, setRemoteCursors] = useState({});
  const [systemLogs, setSystemLogs] = useState(["Sistem Hazır.", "Bağlantı Bekleniyor..."]);
  const logsEndRef = useRef(null); 

  const addLog = (msg) => { setSystemLogs(prev => [...prev.slice(-5), msg]); };
  useEffect(() => { if(logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [systemLogs]);

  // MİMARİ: Seviye arttıkça hacimsel olarak büyür
  const architecture = useMemo(() => {
      const base = [3, 5, 2]; 
      if(aiLevel >= 2) base[1] += 5;       // 10 Nöron
      if(aiLevel >= 3) base.splice(1, 0, 8); // Yeni katman (8 nöron)
      if(aiLevel >= 4) base[2] += 6;       
      if(aiLevel >= 5) base.push(4);
      if(aiLevel >= 6) base.splice(2, 0, 12); // Devasa orta katman
      return base;
  }, [aiLevel]);

  // SOCKET EVENTS
  useEffect(() => {
    socket.on("connect", () => { setIsConnected(true); addLog("✅ BAĞLANDI (Localhost)"); });
    socket.on("disconnect", () => { setIsConnected(false); addLog("❌ Bağlantı Koptu"); });

    socket.on("user_joined_alert", (data) => {
        addLog(`⚠️ RAKİP GELDİ: ${data.userId.substr(0,3)}`);
        broadcastMyStatus(); 
    });

    socket.on("update_player_status", (data) => {
        if(data.userId !== socket.id) {
            setPlayers(prev => ({ ...prev, [data.userId]: data.stats }));
        }
    });

    socket.on("receive_attack", (data) => {
        if(isDead) return;
        setIsUnderAttack(true);
        setTimeout(() => setIsUnderAttack(false), 800); 

        setShield(prevShield => {
            let dmg = data.damage;
            if (prevShield > 0) {
                const absorb = Math.min(prevShield, dmg);
                dmg -= absorb;
                return prevShield - absorb;
            }
            if (dmg > 0) {
                setHp(prevHp => {
                    const newHp = prevHp - dmg;
                    if (newHp <= 0) handleDeath();
                    return newHp;
                });
            }
            return prevShield;
        });
        addLog(`💥 HASAR ALINDI! (-${data.damage})`);
    });

    socket.on("remote_cursor_move", (data) => setRemoteCursors(prev => ({ ...prev, [data.userId]: data.position })));
    socket.on("user_left", (data) => {
        setPlayers(prev => { const n={...prev}; delete n[data.userId]; return n; });
        setRemoteCursors(prev => { const n={...prev}; delete n[data.userId]; return n; });
    });

    return () => {
        socket.off("connect"); socket.off("disconnect");
        socket.off("user_joined_alert"); socket.off("update_player_status");
        socket.off("receive_attack"); socket.off("remote_cursor_move"); socket.off("user_left");
    };
  }, [isDead]);

  useEffect(() => { if(isJoined) broadcastMyStatus(); }, [hp, shield, aiLevel]);

  const broadcastMyStatus = () => {
      socket.emit("broadcast_status", { room, stats: { hp, maxHp, shield, classType: selectedClass, level: aiLevel, isDead } });
  };

  const handleDeath = () => { setIsDead(true); setHp(0); addLog("💀 SİSTEM ÇÖKTÜ."); };

  const joinRoom = () => {
      if (room.trim() !== "") {
          socket.emit("join_room", room.trim());
          setIsJoined(true);
          const stats = CLASSES[selectedClass];
          setHp(stats.hp); setMaxHp(stats.hp); setShield(selectedClass === "TANK" ? 50 : 0); setResources(50);
      }
  };

  const handleMouseMove = (point) => { if (room) socket.emit("cursor_move", { room, position: [point.x, point.y, point.z] }); };

  const handleGather = () => { if(!isDead) setResources(prev => prev + (selectedClass === "HACKER" ? 20 : 10)); };
  
  const handleAttack = () => {
      if(isDead || attackCooldown || resources < 20) return;
      setResources(prev => prev - 20);
      setAttackCooldown(true); setTimeout(() => setAttackCooldown(false), 1200); 
      const dmg = CLASSES[selectedClass].atk + (aiLevel * 5); 
      socket.emit("send_attack", { room, damage: dmg });
      addLog(`⚔️ SALDIRI YAPILDI (Güç: ${dmg})`);
  };

  const handleShield = () => { if(!isDead && resources >= 50) { setResources(p=>p-50); setShield(p=>p+30); addLog("🛡️ Kalkan +30"); }};
  const handleUpgrade = () => { 
      const cost = aiLevel * 150; 
      if(!isDead && resources >= cost) { setResources(p=>p-cost); setAiLevel(p=>p+1); addLog(`🧬 LEVEL UP! (Lv. ${aiLevel+1})`); }
  };

  // --- 1. GİRİŞ EKRANI (CSS DÜZELTİLDİ: YARIM KALMA YOK) ---
  if (!isJoined) {
    return (
      // 'position: fixed' ve 'inset: 0' sayesinde ekranı zorla kaplar, scroll bar çıkmaz.
      <div style={{ position: 'fixed', inset: 0, background: '#050005', zIndex: 9999 }}>
        
        {/* ARKA PLAN 3D SAHNE */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
            <Canvas camera={{ position: [0, 0, 80], fov: 60 }}>
                <color attach="background" args={['#0b0b1a']} />
                <Stars radius={150} depth={50} count={6000} factor={7} saturation={0} fade />
                <ambientLight intensity={1.5} />
                <pointLight position={[20, 20, 20]} intensity={5} color="#00aaff" />
                <NeuralNetwork architecture={[3, 5, 3]} isUnderAttack={false} />
                <OrbitControls autoRotate autoRotateSpeed={1.5} enableZoom={false} enablePan={false} />
            </Canvas>
        </div>
        
        {/* UI KATMANI (ORTALANMIŞ & FULL EKRAN) */}
        <div style={{ 
            position: 'absolute', inset: 0, zIndex: 10, 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)' 
        }}>
          
          <h1 style={{ 
            fontSize: '70px', color: '#fff', marginBottom: '40px', 
            fontFamily: "'Courier New', monospace", letterSpacing: '8px', 
            textShadow: '0 0 30px var(--neon-blue)' 
          }}>
            NEURO<span style={{color:'var(--neon-red)'}}>WARS</span>
          </h1>

          {/* SINIF KARTLARI */}
          <div style={{ display: 'flex', gap: '25px', marginBottom: '40px' }}>
              {Object.keys(CLASSES).map(cls => (
                  <div key={cls} onClick={() => setSelectedClass(cls)} style={{ 
                      width: '180px', padding: '25px', 
                      background: selectedClass === cls ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.7)', 
                      border: selectedClass === cls ? `2px solid ${CLASSES[cls].color}` : '1px solid #444', 
                      borderRadius: '16px', cursor: 'pointer', 
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', 
                      transition: '0.3s', transform: selectedClass === cls ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: selectedClass === cls ? `0 0 30px ${CLASSES[cls].color}66` : 'none'
                  }}>
                      <div style={{ fontSize: '50px' }}>{CLASSES[cls].icon}</div>
                      <div style={{ fontWeight: 'bold', fontSize:'20px', color: CLASSES[cls].color }}>{CLASSES[cls].name}</div>
                      <div style={{ fontSize: '13px', color: '#ccc' }}>HP: {CLASSES[cls].hp} | ATK: {CLASSES[cls].atk}</div>
                  </div>
              ))}
          </div>

          {/* GİRİŞ INPUT & BUTON */}
          <div style={{ display: 'flex', gap: '15px' }}>
              <input type="text" placeholder="ODA NO (Örn: 101)" onChange={(e) => setRoom(e.target.value)} onKeyPress={(e) => e.key === "Enter" && joinRoom()} 
                     style={{ padding: '15px', fontSize: '18px', background: '#000', border: '1px solid #555', color: '#fff', borderRadius: '8px', textAlign: 'center', width: '200px', outline:'none' }} />
              
              <button onClick={joinRoom} disabled={!isConnected} 
                      style={{ padding: '15px 35px', fontSize: '18px', fontWeight: 'bold', background: isConnected ? 'var(--neon-blue)' : '#333', color: isConnected ? '#000' : '#666', border: 'none', borderRadius: '8px', cursor: isConnected ? 'pointer' : 'not-allowed', boxShadow: isConnected ? '0 0 20px var(--neon-blue)' : 'none' }}>
                  {isConnected ? "SAVAŞA KATIL" : "BAĞLANIYOR..."}
              </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. OYUN EKRANI ---
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0b0b1a", position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* ÜST HUD */}
      <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', width: '600px', display:'flex', gap:'20px', zIndex:10 }}>
          <div style={{flex:1, height:'25px', background:'#222', borderRadius:'12px', overflow:'hidden', border:'2px solid #444', position:'relative', boxShadow:'0 0 15px rgba(0,0,0,0.5)'}}>
              <div style={{width: `${(hp/maxHp)*100}%`, height:'100%', background:'linear-gradient(90deg, #aa0000, #ff0000)', transition:'width 0.3s'}}></div>
              <div style={{position:'absolute', top:0, width:'100%', lineHeight:'22px', textAlign:'center', fontSize:'12px', fontWeight:'bold', color:'#fff'}}>HP: {hp} / {maxHp}</div>
          </div>
          <div style={{flex:1, height:'25px', background:'#222', borderRadius:'12px', overflow:'hidden', border:'2px solid #444', position:'relative', boxShadow:'0 0 15px rgba(0,0,0,0.5)'}}>
              <div style={{width: `${Math.min(100, shield)}%`, height:'100%', background:'linear-gradient(90deg, #aa8800, #ffff00)', transition:'width 0.3s'}}></div>
              <div style={{position:'absolute', top:0, width:'100%', lineHeight:'22px', textAlign:'center', fontSize:'12px', fontWeight:'bold', color:'#fff'}}>KALKAN: {shield}</div>
          </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
          {isUnderAttack && <div className="damage-overlay" />}
          <Canvas camera={{ position: [0, 0, 140], fov: 50 }}> 
            <color attach="background" args={['#0b0b1a']} /> 
            <fog attach="fog" args={['#0b0b1a', 100, 600]} />
            <ambientLight intensity={2} /> 
            <pointLight position={[50, 50, 50]} intensity={5} color="#00aaff" />
            <pointLight position={[-50, -50, -50]} intensity={5} color="#ff0055" />
            <Stars radius={200} depth={50} count={8000} factor={7} saturation={0} fade />
            <MousePlane onMove={handleMouseMove} />
            <RemoteCursors cursors={remoteCursors} />
            <NeuralNetwork architecture={architecture} isUnderAttack={isUnderAttack} />
            <OrbitControls enablePan={false} minDistance={50} maxDistance={500} autoRotate={true} autoRotateSpeed={isUnderAttack ? 5.0 : 0.5} />
          </Canvas>
          <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.6)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid var(--neon-blue)', fontFamily: "'Courier New', monospace", fontSize: '11px', color: 'var(--neon-blue)', width: '300px', pointerEvents: 'none' }}>
              {systemLogs.map((log, index) => (<div key={index} style={{ opacity: (index + 2) / (systemLogs.length + 1), marginBottom:'4px' }}>{`> ${log}`}</div>))}
              <div ref={logsEndRef} />
          </div>
      </div>

      <div style={{ height: '140px', background: 'rgba(10, 10, 20, 0.95)', backdropFilter: 'blur(15px)', borderTop: '2px solid #444', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px', padding: '0 30px', zIndex: 20 }}>
        <div style={{textAlign:'center', width:'120px'}}>
            <div style={{fontSize:'36px', fontWeight:'900', color:'#fff', textShadow:'0 0 15px var(--neon-blue)'}}>{resources}</div>
            <div style={{fontSize:'10px', color:'#aaa'}}>ENERJİ</div>
        </div>
        <button onClick={handleGather} className="war-btn blue"><div style={{fontSize:'22px'}}>⚡</div><div>TOPLA</div></button>
        <button onClick={handleAttack} disabled={attackCooldown} className="war-btn red" style={{transform: attackCooldown ? 'scale(0.95)' : 'scale(1)', opacity: attackCooldown?0.6:1}}><div style={{fontSize:'22px'}}>⚔️</div><div>SALDIR</div></button>
        <button onClick={handleShield} className="war-btn yellow"><div style={{fontSize:'22px'}}>🛡️</div><div>KALKAN</div></button>
        <button onClick={handleUpgrade} className="war-btn green"><div style={{fontSize:'22px'}}>🧬</div><div>EVRİM (Lv.{aiLevel+1})</div></button>
      </div>
    </div>
  );
}

export default App;