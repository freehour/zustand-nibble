import type { Immutable } from 'immer';
import type { StateCreator } from 'zustand';


export interface ChildState {
    name: string;
    age: number;
    birthday: () => void;
}

export type ParentState = Immutable<{
    name: string;
    age: number;
    child: ChildState;
    birthday: () => void;
}>;

export const createJoe: StateCreator<ChildState> = set => ({
    name: 'Joe Doe',
    age: 10,
    birthday: () => set(state => ({ age: state.age + 1 })),
});
