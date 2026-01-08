// src/context/DataContext.js
'use client';
import { createContext, useContext, useState } from 'react';

const DataContext = createContext();

export function DataProvider({ children }) {
  // Armazenamos os dados globais aqui
  const [cache, setCache] = useState({
    discente: null,
    docente: null,
    tecnico: null,
  });

  // Função para salvar no cache
  const saveToCache = (key, data) => {
    setCache((prev) => ({ ...prev, [key]: data }));
  };

  return (
    <DataContext.Provider value={{ cache, saveToCache }}>
      {children}
    </DataContext.Provider>
  );
}

export const useGlobalData = () => useContext(DataContext);