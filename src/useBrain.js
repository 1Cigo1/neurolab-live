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
        activation: index === architecture.length - 1 ? 'sigmoid' : 'relu',
        useBias: true,
        kernelInitializer: 'heNormal' 
      }));
    });

    // İlk derleme (Varsayılan hız ile)
    model.compile({ 
      optimizer: tf.train.adam(0.03), 
      loss: 'meanSquaredError' 
    });

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
        const wData = await wTensor.array(); 
        newWeights.push(wData);
      }
    }
    setWeights(newWeights);
  };

  const runPrediction = async (model) => {
    const xs = tf.tensor2d([[0,0], [0,1], [1,0], [1,1]]);
    const predsTensor = model.predict(xs);
    const predsData = await predsTensor.data(); 
    setPredictions(Array.from(predsData));
    xs.dispose();
    predsTensor.dispose();
  };

  // BURASI DEĞİŞTİ: Artık dışarıdan 'learningRate' alıyor
  const train = async (learningRate = 0.03) => {
    if(!modelRef.current) return;
    setIsTraining(true);

    const xs = tf.tensor2d([[0,0], [0,1], [1,0], [1,1]]);
    const ys = tf.tensor2d([[0], [1], [1], [0]]); 

    // Modeli seçilen hızla yeniden derle
    modelRef.current.compile({ 
      optimizer: tf.train.adam(parseFloat(learningRate)), 
      loss: 'meanSquaredError' 
    });

    for (let i = 0; i < 80; i++) { 
      const h = await modelRef.current.fit(xs, ys, {
        epochs: 1, 
        shuffle: true
      });
      
      setLoss(h.history.loss[0].toFixed(4));
      
      if (i % 2 === 0) {
        await extractData(modelRef.current);
        await runPrediction(modelRef.current);
        await new Promise(r => setTimeout(r, 50)); 
      }
    }
    
    await extractData(modelRef.current);
    await runPrediction(modelRef.current);

    setIsTraining(false);
    xs.dispose(); ys.dispose(); 
  };

  return { weights, loss, isTraining, predictions, train };
};