import { createStore } from 'zustand';
import nibble from 'zustand-nibble';

interface ParentState {
    name: string;
    age: number;
    child: {
        name: string;
        age: number;
    };
}

const createChildName = nibble<ParentState>()(state => state.child.name)(name => draft => {
    draft.name = name;
});

const parentStore = createStore<ParentState>()((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: {
        name: createChildName(api, () => 'Joe Doe'),
        age: 10,
    },
}));

export const childStore = createChildName(parentStore);
