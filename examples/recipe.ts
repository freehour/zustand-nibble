import { create } from 'zustand';
import nibble from 'zustand-nibble';

import { createJoe, type ParentState } from './state';

const createChild = nibble<ParentState>()(state => state.child);

export const useDad = create<ParentState>()((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: createChild(api, createJoe),
    birthday: () => set(state => ({ age: state.age + 1 })),
}));

export const useMom = create<ParentState>()((set, get, api) => ({
    name: 'Jane Doe',
    age: 37,
    child: createChild(api, createJoe),
    birthday: () => set(state => ({ age: state.age + 1 })),
}));
