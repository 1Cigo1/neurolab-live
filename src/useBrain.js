import { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';

export const useBrain = (architecture) => {
  const [weights, setWeights] = useState([]); 
  const [loss, setLoss] = useState(null); 
  const [isTraining, setIsTraining] = useState(false);
  const [predictions, setPredictions] = useState([]); 

  const modelRef = useRef(null);

  useEffect(() => {
    if(modelRef.current) modelRef.current.dispose();
    const model = tf.sequential();
    
    architecture.forEach((neuronCount, index) => {
      if (index === 0) return; 
      const prevNeurons = architecture[index - 1];
      model.add(tf.layers.dense({
        units: neuronCount,
        inputShape: index === 1 ? [prevNeurons] : undefined,
        activation: index === architecture.length - 1 ? 'sigmoid' : 'tanh', // tanh görsel olarak daha iyi veri üretir
        useBias: true,
        kernelInitializer: 'glorotNormal' 
      }));
    });

    model.compile({ optimizer: tf.train.adam(0.05), loss: 'meanSquaredError' });
    modelRef.current = model;
    extractData(model);
    runPrediction(model);
  }, [architecture]);

  const extractData = async (model) => {
    const newWeights = [];
    for (let i = 0; i < model.layers.length; i++) {
      const layer = model.layers[i];
      const wTensor = layer.getWeights()[0]; 
      if(wTensor) {
        newWeights.push(await wTensor.array());
      }
    }
    setWeights(newWeights);
  };

  const runPrediction = async (model) => {
    const xs = tf.tensor2d([[0,0], [0,1], [1,0], [1,1]]);
    const preds = await model.predict(xs).data();
    setPredictions(Array.from(preds));
    xs.dispose();
  };

  const train = async (learningRate, selectedTargets, onLog) => {
    if(!modelRef.current) return;
    setIsTraining(true);
    if(onLog) onLog(`⚡ EĞİTİM BAŞLADI... Hız: ${learningRate}`);

    const xs = tf.tensor2d([[0,0], [0,1], [1,0], [1,1]]);
    const ys = tf.tensor2d(selectedTargets.map(t => [t])); 

    modelRef.current.compile({ optimizer: tf.train.adam(parseFloat(learningRate)), loss: 'meanSquaredError' });

    for (let i = 0; i < 60; i++) { // 60 Epoch
      const h = await modelRef.current.fit(xs, ys, { epochs: 1, shuffle: true });
      const currentLoss = h.history.loss[0].toFixed(5);
      setLoss(currentLoss);
      
      if (i % 3 === 0) { // Daha sık güncelleme (Görsel akış için)
        await extractData(modelRef.current);
        await runPrediction(modelRef.current);
        if(onLog) onLog(`Epoch ${i} > Hata: ${currentLoss}`);
        await new Promise(r => setTimeout(r, 20)); // Animasyona nefes payı
      }
    }
    
    if(onLog) onLog(`🏁 BİTTİ. Son Hata: ${loss}`);
    await extractData(modelRef.current);
    await runPrediction(modelRef.current);
    setIsTraining(false);
    xs.dispose(); ys.dispose(); 
  };

  return { weights, loss, isTraining, predictions, train };
};