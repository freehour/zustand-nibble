
import type { StateCreator } from 'zustand';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import nibble from 'zustand-nibble';

import type { ChildState, ParentState } from './state';


export const createJoe: StateCreator<ChildState, [['zustand/immer', never]]> = set => ({
    name: 'Joe Doe',
    age: 10,
    birthday: () => set(draft => {
        draft.age += 1;
    }),
});


export const useParent = create<ParentState>()((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: nibble(api)(state => state.child)(immer(createJoe)),
    birthday: () => set(state => ({ age: state.age + 1 })),
}));
