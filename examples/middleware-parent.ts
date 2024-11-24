

import type { StateCreator } from 'zustand';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import nibble from 'zustand-nibble';

import type { ChildState, ParentState } from './state';


export const createJoe: StateCreator<ChildState> = set => ({
    name: 'Joe Doe',
    age: 10,
    birthday: () => set(state => ({ age: state.age + 1 })),
});


export const useParent = create<ParentState>()(immer((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: nibble<ParentState>(api)(state => state.child, set)(createJoe),
    birthday: () => {},
})));
