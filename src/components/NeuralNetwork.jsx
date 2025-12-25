import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- ELEKTRON (VİRÜS & VERİ) ---
const Electron = ({ start, end, speed, color, offset, isVirus }) => {
  const meshRef = useRef();
  const startVec = useMemo(() => new THREE.Vector3(...start), [start]);
  const endVec = useMemo(() => new THREE.Vector3(...end), [end]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const finalSpeed = isVirus ? speed * 2.0 : speed; 
    const t = (time * finalSpeed + offset) % 1; 
    
    meshRef.current.position.lerpVectors(startVec, endVec, t);

    if (isVirus) {
        meshRef.current.position.x += (Math.random() - 0.5) * 0.5;
        meshRef.current.position.y += (Math.random() - 0.5) * 0.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[isVirus ? 0.6 : 0.3, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
};

// --- NÖRON ---
const Neuron = ({ position, layerIndex, isDamaged }) => {
  const meshRef = useRef();
  const baseColor = isDamaged ? "#ff0000" : (layerIndex === 0 ? "#00aaff" : (layerIndex % 2 === 0 ? "#00ff88" : "#cc00ff"));

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const scale = 1.0 + Math.sin(time * 2 + position[0]) * 0.15;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <dodecahedronGeometry args={[1.2, 0]} /> 
      <meshStandardMaterial 
        color={baseColor} 
        emissive={baseColor}
        emissiveIntensity={isDamaged ? 3 : 1.2}
        roughness={0.2}
        metalness={0.8}
      />
      <pointLight distance={10} intensity={1} color={baseColor} />
    </mesh>
  );
};

// --- BAĞLANTI ---
const Connection = ({ start, end, isUnderAttack }) => {
  const speed = useMemo(() => 0.3 + Math.random() * 0.4, []);
  const offset = useMemo(() => Math.random(), []);
  
  return (
    <group>
      <line>
        <bufferGeometry><bufferAttribute attach="attributes-position" count={2} array={new Float32Array([...start, ...end])} itemSize={3} /></bufferGeometry>
        <lineBasicMaterial color={isUnderAttack ? "#550000" : "#ffffff"} transparent opacity={0.05} />
      </line>
      <Electron start={start} end={end} speed={speed} color="#00aaff" offset={offset} isVirus={false} />
      {isUnderAttack && (
         <Electron start={start} end={end} speed={speed * 1.5} color="#ff0000" offset={offset + 0.5} isVirus={true} />
      )}
    </group>
  );
};

const NeuralNetwork = ({ architecture, isUnderAttack }) => {
  const layers = useMemo(() => {
    const computed = [];
    architecture.forEach((count, lIdx) => {
      const neurons = [];
      const isInput = lIdx === 0;
      const isOutput = lIdx === architecture.length - 1;

      for (let i = 0; i < count; i++) {
        // --- YENİ 3D MATEMATİĞİ (KÜRESEL DAĞILIM) ---
        
        // X ekseni yine katmanları ayırır ama daha sıkışık
        const x = (lIdx - (architecture.length - 1) / 2) * 30; 
        
        let y, z;

        if (isInput || isOutput) {
            // Giriş ve Çıkış: Düz duvar gibi dursun
            y = (i - (count - 1) / 2) * 12;
            z = 0;
        } else {
            // ARA KATMANLAR: Spiral Küre Formu
            // Fibonacci Spirali mantığına benzer bir dağılım
            const radius = 15 + (count * 0.5); // Nöron sayısı arttıkça küre şişer
            const phi = Math.acos( -1 + ( 2 * i ) / count );
            const theta = Math.sqrt( count * Math.PI ) * phi;

            y = radius * Math.cos(theta) * Math.sin(phi);
            z = radius * Math.sin(theta) * Math.sin(phi);
            
            // Biraz rastgelelik (titreşim) ekle
            y += (Math.random() - 0.5) * 5;
            z += (Math.random() - 0.5) * 5;
        }

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