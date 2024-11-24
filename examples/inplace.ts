import { produce } from 'immer';
import { create } from 'zustand';
import nibble from 'zustand-nibble';

import type { ParentState } from './state';


export const useParent = create<ParentState>()((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: nibble(api)(state => state.child, produce)(set => ({
        name: 'Joe Doe',
        age: 10,
        birthday: () => set(state => ({ age: state.age + 1 })),
    })),
    birthday: () => set(state => ({ age: state.age + 1 })),
}));
