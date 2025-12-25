import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Electron = ({ start, end, speed, color, offset, isVirus }) => {
  const meshRef = useRef();
  const startVec = useMemo(() => new THREE.Vector3(...start), [start]);
  const endVec = useMemo(() => new THREE.Vector3(...end), [end]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const finalSpeed = isVirus ? speed * 2.5 : speed; 
    const t = (time * finalSpeed + offset) % 1; 
    meshRef.current.position.lerpVectors(startVec, endVec, t);
    
    // Virüs titremesi
    if (isVirus) {
        meshRef.current.position.x += (Math.random() - 0.5) * 0.5;
        meshRef.current.position.y += (Math.random() - 0.5) * 0.5;
    }
  });

  return <mesh ref={meshRef}><sphereGeometry args={[isVirus ? 0.6 : 0.3, 8, 8]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>;
};

const Neuron = ({ position, layerIndex, isDamaged }) => {
  const meshRef = useRef();
  const baseColor = isDamaged ? "#ff0000" : (layerIndex === 0 ? "#00aaff" : (layerIndex % 2 === 0 ? "#00ff88" : "#cc00ff"));

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // Rastgele nefes alma hızı
    const scale = 1.0 + Math.sin(time * (1.5 + Math.random()) + position[0]) * 0.2;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <dodecahedronGeometry args={[1.5, 0]} /> {/* Nöronları iyice büyüttük */}
      <meshStandardMaterial color={baseColor} emissive={baseColor} emissiveIntensity={isDamaged ? 3 : 1.5} roughness={0.2} />
      <pointLight distance={15} intensity={1} color={baseColor} />
    </mesh>
  );
};

const Connection = ({ start, end, isUnderAttack }) => {
  const speed = useMemo(() => 0.2 + Math.random() * 0.4, []); // Biraz yavaşlattık ki akış görülsün
  const offset = useMemo(() => Math.random(), []);
  
  return (
    <group>
      <line>
        <bufferGeometry><bufferAttribute attach="attributes-position" count={2} array={new Float32Array([...start, ...end])} itemSize={3} /></bufferGeometry>
        <lineBasicMaterial color={isUnderAttack ? "#550000" : "#ffffff"} transparent opacity={0.05} />
      </line>
      <Electron start={start} end={end} speed={speed} color="#00ffff" offset={offset} isVirus={false} />
      {isUnderAttack && <Electron start={start} end={end} speed={speed * 2.0} color="#ff0000" offset={offset + 0.5} isVirus={true} />}
    </group>
  );
};

const NeuralNetwork = ({ architecture, isUnderAttack }) => {
  const layers = useMemo(() => {
    const computed = [];
    architecture.forEach((count, lIdx) => {
      const neurons = [];
      // Rastgelelik için her katmana özel bir 'çekirdek' noktası belirlemiyoruz,
      // tamamen uzaya yayıyoruz.
      
      for (let i = 0; i < count; i++) {
        // --- TAM KÜRESEL & KAOTİK DAĞILIM ---
        // Fibonacci Küresi mantığıyla noktaları küre yüzeyine ve içine yayıyoruz.
        
        // Katmanlar iç içe geçmiş küreler gibi olsun
        // Level arttıkça küre büyüsün
        const sphereRadius = 20 + (lIdx * 10); 
        
        // Rastgele küresel koordinatlar
        const theta = Math.random() * Math.PI * 2; // Yatay açı
        const phi = Math.acos((Math.random() * 2) - 1); // Dikey açı
        
        // Biraz rastgelelik ekle ki dümdüz küre olmasın
        const r = sphereRadius + (Math.random() - 0.5) * 10;

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        neurons.push({ id: `${lIdx}-${i}`, position: [x, y, z], lIdx });
      }
      computed.push(neurons);
    });
    return computed;
  }, [architecture]);

  return (
    <group>
      {layers.map(layer => layer.map(n => <Neuron key={n.id} position={n.position} layerIndex={n.lIdx} isDamaged={isUnderAttack} />))}
      {layers.slice(0, -1).map((layer, lIdx) => 
        layer.map(start => layers[lIdx+1].map(end => 
             <Connection key={`${start.id}-${end.id}`} start={start.position} end={end.position} isUnderAttack={isUnderAttack} />
        ))
      )}
    </group>
  );
};

export default NeuralNetwork;