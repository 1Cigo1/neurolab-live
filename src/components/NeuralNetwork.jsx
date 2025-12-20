import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei'; 
import * as THREE from 'three';

// --- 1. ELEKTRON (ENERJİ TOPU) ---
const Electron = ({ start, end, speed, offset }) => {
  const meshRef = useRef();
  const startVec = useMemo(() => new THREE.Vector3(...start), [start]);
  const endVec = useMemo(() => new THREE.Vector3(...end), [end]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const t = (time * speed + offset) % 1; 
    meshRef.current.position.lerpVectors(startVec, endVec, t);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.2, 8, 8]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </mesh>
  );
};

// --- 2. NÖRON (YILDIZ/HÜCRE) + DEV BİLGİ ETİKETİ ---
const Neuron = ({ id, position, isActive, isInput, isOutput, isDead, onClick }) => {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    if (isDead) {
        meshRef.current.scale.setScalar(1.0); 
        return; 
    }

    const time = state.clock.getElapsedTime();
    meshRef.current.position.y += Math.sin(time + position[0]) * 0.005;
    meshRef.current.position.z += Math.cos(time + position[1]) * 0.005;

    let targetScale = (isActive ? 2.5 : 1.8) + Math.sin(time * 3) * 0.2;
    if (hovered) targetScale += 0.5; 

    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    meshRef.current.rotation.y += 0.01;
  });

  let color = "#ffffff"; 
  let emissiveIntensity = 0.8;

  if (isDead) {
    color = "#111111"; 
    emissiveIntensity = 0; 
  } else if (isActive) {
    color = "#00ff00"; 
    emissiveIntensity = 3;
  } else if (isInput) {
    color = "#00aaff"; 
  } else if (isOutput) {
    color = "#ff0055"; 
  }

  return (
    <group position={position}>
      <mesh 
        ref={meshRef} 
        onClick={(e) => { e.stopPropagation(); onClick(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
        style={{ cursor: 'pointer' }}
      >
        <dodecahedronGeometry args={[0.5, 0]} /> 
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={isDead ? 0.9 : 0.2} 
          metalness={isDead ? 0.1 : 0.8}
        />
      </mesh>

      {/* --- BÜYÜTÜLMÜŞ NÖRON ETİKETİ --- */}
      {hovered && !isDead && (
        <Html distanceFactor={15}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.9)',
            color: color,
            padding: '8px 12px', // Kutuyu büyüttüm
            borderRadius: '6px',
            border: `2px solid ${color}`, // Çerçeveyi kalınlaştırdım
            fontSize: '18px', // YAZIYI BÜYÜTTÜM (12px -> 18px)
            fontWeight: 'bold', // Kalın Yazı
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            transform: 'translate3d(0, -60px, 0)', // Biraz daha yukarı aldım
            boxShadow: `0 0 15px ${color}`
          }}>
            NÖRON ID: {id}
          </div>
        </Html>
      )}
    </group>
  );
};

// --- 3. BAĞLANTI (KABLO) + DEV AĞIRLIK GÖSTERGESİ ---
const Connection = ({ start, end, weight, isDeadConnection }) => {
  const [hovered, setHover] = useState(false);

  if (!start || !end || isDeadConnection) return null;

  const hasWeight = weight !== undefined && weight !== null;
  const intensity = hasWeight ? Math.abs(weight) : 0;
  
  let linkColor = '#ffffff'; 
  let opacity = 0.15;        
  let lineWidth = 1;

  if (hasWeight) {
    linkColor = weight > 0 ? '#00ff88' : '#ff0055';
    opacity = 0.6; 
    lineWidth = 2;
  }

  if (hovered) {
    opacity = 1.0;
    lineWidth = 4;
  }

  const midPoint = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2
  ];

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([...start, ...end])} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color={linkColor} transparent opacity={opacity} linewidth={lineWidth} />
      </line>

      <line 
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
      >
         <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([...start, ...end])} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="white" transparent opacity={0} linewidth={20} />
      </line>

      {/* --- BÜYÜTÜLMÜŞ AĞIRLIK ETİKETİ --- */}
      {hovered && hasWeight && (
        <Html position={midPoint} distanceFactor={15} zIndexRange={[100, 0]}>
          <div style={{
            background: 'rgba(10, 10, 20, 0.95)', // Arka planı koyulaştırdım
            backdropFilter: 'blur(4px)',
            color: linkColor,
            padding: '8px 14px', // Daha geniş kutu
            borderRadius: '8px',
            border: `2px solid ${linkColor}`, // Kalın çerçeve
            fontSize: '20px', // YAZIYI BÜYÜTTÜM (10px -> 16px)
            fontWeight: 'bold', // Kalınlaştırdım
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            boxShadow: `0 0 20px ${linkColor}`, // Neon parlamayı artırdım
            pointerEvents: 'none'
          }}>
            W: {weight.toFixed(4)}
          </div>
        </Html>
      )}

      {hasWeight && intensity > 0.1 && (
        <Electron start={start} end={end} speed={intensity * 2} offset={Math.random()} />
      )}
    </group>
  );
};

// --- ANA BİLEŞEN ---
const NeuralNetwork = ({ architecture, weights, manualInput, deadNeurons = [], onNeuronClick }) => {
  if (!architecture || architecture.length === 0) return null;

  const layers = useMemo(() => {
    const computedLayers = [];
    const totalLayers = architecture.length;
    const universeSize = Math.max(60, totalLayers * 20); 

    architecture.forEach((neuronCount, layerIndex) => {
      const layerNeurons = [];
      const isInput = layerIndex === 0;
      const isOutput = layerIndex === totalLayers - 1;

      for (let i = 0; i < neuronCount; i++) {
        let x, y, z;

        if (isInput) {
          x = -universeSize / 1.5; 
          y = (i - (neuronCount - 1) / 2) * 8; 
          z = 0;
        } 
        else if (isOutput) {
          x = universeSize / 1.5;
          y = (i - (neuronCount - 1) / 2) * 15;
          z = 0;
        } 
        else {
          x = (Math.random() - 0.5) * universeSize; 
          const spread = universeSize * 0.6; 
          y = (Math.random() - 0.5) * spread;
          z = (Math.random() - 0.5) * spread;
        }

        layerNeurons.push({ 
          id: `${layerIndex}-${i}`, 
          position: [x, y, z],
          isInput,
          isOutput
        });
      }
      computedLayers.push(layerNeurons);
    });
    return computedLayers;
  }, [architecture]);

  return (
    <group>
      {/* Nöronları Çiz */}
      {layers.map((layer, layerIndex) => 
        layer.map((neuron, neuronIndex) => {
          
          let isActive = false;
          if (layerIndex === 0 && manualInput && manualInput.length > neuronIndex) {
             isActive = manualInput[neuronIndex] === 1;
          }

          const isDead = deadNeurons.includes(neuron.id);

          return (
            <Neuron 
              key={neuron.id} 
              id={neuron.id}
              position={neuron.position} 
              isActive={isActive} 
              isInput={neuron.isInput}
              isOutput={neuron.isOutput}
              isDead={isDead}
              onClick={onNeuronClick}
            />
          )
        })
      )}

      {/* Bağlantıları Çiz */}
      {layers.slice(0, -1).map((currentLayer, layerIndex) => {
        const nextLayer = layers[layerIndex + 1];
        
        return currentLayer.map((startNeuron, fromIndex) => {
          return nextLayer.map((endNeuron, toIndex) => {
             
             let weight = undefined;
             if (weights && weights[layerIndex] && weights[layerIndex][fromIndex]) {
               weight = weights[layerIndex][fromIndex][toIndex];
             }

             const isStartDead = deadNeurons.includes(startNeuron.id);
             const isEndDead = deadNeurons.includes(endNeuron.id);
             const isDeadConnection = isStartDead || isEndDead;

             return (
               <Connection 
                 key={`${startNeuron.id}-${endNeuron.id}`}
                 start={startNeuron.position}
                 end={endNeuron.position}
                 weight={weight}
                 isDeadConnection={isDeadConnection}
               />
             )
          })
        })
      })}
    </group>
  );
};

export default NeuralNetwork;