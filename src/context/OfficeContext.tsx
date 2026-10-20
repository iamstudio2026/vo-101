import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentIdRef.current = currentOffice?.id ?? null;
  }, [currentOffice]);

  useEffect(() => {
    if (!currentUser) {
      setOffices([]);
      setCurrentOffice(null);
      return;
    }

    // Offices are shared: the ones I own plus the ones I'm a member of. Two listeners
    // (merged) so offices created before memberIds existed still show up for their owner.
    const owned = new Map<string, Office>();
    const joined = new Map<string, Office>();
    const publish = () => {
      const merged = new Map([...joined, ...owned]);
      const list = [...merged.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setOffices(list);
      const keep = list.find(o => o.id === currentIdRef.current);
      setCurrentOffice(keep ?? list[0] ?? null);
    };
    const fill = (target: Map<string, Office>) => (snapshot: any) => {
      target.clear();
      snapshot.docs.forEach((d: any) => target.set(d.id, { id: d.id, ...d.data() } as Office));
      publish();
    };

    const unsubOwned = onSnapshot(
      query(collection(db, 'offices'), where('ownerId', '==', currentUser.uid)),
      fill(owned),
      (e) => console.error('Offices (owned) listener:', e),
    );
    const unsubJoined = onSnapshot(
      query(collection(db, 'offices'), where('memberIds', 'array-contains', currentUser.uid)),
      fill(joined),
      (e) => console.error('Offices (member) listener:', e),
    );
    return () => {
      unsubOwned();
      unsubJoined();
    };
  }, [currentUser]);

  return (
    <OfficeContext.Provider value={{ currentOffice, setCurrentOffice, offices }}>
      {children}
    </OfficeContext.Provider>
  );
};
