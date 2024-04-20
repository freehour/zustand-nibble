import { createStore } from 'zustand';
import nibble from 'zustand-nibble';

import type { ParentState } from './state';
import { createJoe } from './state';

const createChild = nibble<ParentState>()(state => state.child)();

const parentStore = createStore<ParentState>()((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: createChild(api, createJoe), // ChildState
    birthday: () => set(state => ({ age: state.age + 1 })),
}));

export const childStore = createChild(parentStore); // StoreApi<ChildState>
