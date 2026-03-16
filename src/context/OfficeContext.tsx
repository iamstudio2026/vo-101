import React, { createContext, useContext, useState, useEffect } from 'react';
import { Office } from '../types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

interface OfficeContextType {
  currentOffice: Office | null;
  setCurrentOffice: (office: Office | null) => void;
  offices: Office[];
}

const OfficeContext = createContext<OfficeContextType>({ currentOffice: null, setCurrentOffice: () => {}, offices: [] });

export const useOffice = () => useContext(OfficeContext);

export const OfficeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [currentOffice, setCurrentOffice] = useState<Office | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setOffices([]);
      setCurrentOffice(null);
      return;
    }

    const q = query(collection(db, 'offices'), where('ownerId', '==', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOffices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Office));
      setOffices(fetchedOffices);
      
      if (fetchedOffices.length > 0) {
        if (!currentOffice) {
          setCurrentOffice(fetchedOffices[0]);
        } else {
          const latest = fetchedOffices.find(o => o.id === currentOffice.id);
          if (latest) {
            setCurrentOffice(latest);
          } else {
            setCurrentOffice(fetchedOffices[0]);
          }
        }
      } else {
        setCurrentOffice(null);
      }
    });

    return unsubscribe;
  }, [currentUser]);

  return (
    <OfficeContext.Provider value={{ currentOffice, setCurrentOffice, offices }}>
      {children}
    </OfficeContext.Provider>
  );
};
