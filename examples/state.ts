import type { StateCreator } from 'zustand';


export interface ChildState {
    name: string;
    age: number;
    birthday: () => void;
}

export interface ParentState {
    name: string;
    age: number;
    child: ChildState;
    birthday: () => void;
}

export const createJoe: StateCreator<ChildState> = set => ({
    name: 'Joe Doe',
    age: 10,
    birthday: () => set(state => ({ age: state.age + 1 })),
});
