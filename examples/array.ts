import { create } from 'zustand';
import type { Recipe } from 'zustand-nibble';
import nibble from 'zustand-nibble';


interface Todo {
    id: string;
    text: string;
    done: boolean;
    markDone: () => void;
}

interface TodoList {
    todos: Todo[];
    addTodo: (id: string, text: string) => void;
}

function createTodo(id: string): Recipe<TodoList, Todo> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return nibble<TodoList>()(state => state.todos.find(todo => todo.id === id)!);
}

export const useTodoList = create<TodoList>()((set, get, api) => ({
    todos: [],
    addTodo: (id, text) => set(state => ({
        todos: [
            ...state.todos,
            createTodo(id)(api, set => ({
                id,
                text,
                done: false,
                markDone: () => set(state => ({ done: !state.done })),
            })),
        ],
    })),
}));

useTodoList(state => state.todos.at(0)?.markDone);
