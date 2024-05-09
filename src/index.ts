import { castImmutable, produce, type Immutable } from 'immer';
import { isFunction } from 'is-runtype';
import type { StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand';

export type Getter<T, A> = (state: Immutable<T>) => A;

export interface Nibble<A extends object> {
    (): StoreApi<A>;
    <Mps extends [StoreMutatorIdentifier, unknown][] = [], Mcs extends [StoreMutatorIdentifier, unknown][] = []>(
        f: StateCreator<A, Mps, Mcs>,
    ): A;
}

export interface Recipe<T, A extends object> {
    (api: StoreApi<T>): StoreApi<A>;
    <Mps extends [StoreMutatorIdentifier, unknown][] = [], Mcs extends [StoreMutatorIdentifier, unknown][] = []>(
        api: StoreApi<T>,
        f: StateCreator<A, Mps, Mcs>,
    ): A;
}

interface CreateNibble {
    <T>(api: StoreApi<T>): <A extends object>(getter: Getter<T, A>) => Nibble<A>;
    <T>(): <A extends object>(getter: Getter<T, A>) => Recipe<T, A>;
}

function creator<T, A extends object>(getter: Getter<T, A>): StateCreator<T, [], [], StoreApi<A>> {
    return (set, get, api) => ({
        getState: () => getter(castImmutable(get())),
        getInitialState: () => getter(castImmutable(api.getInitialState())),
        setState: (partial, replace) => {
            const nextState = isFunction(partial) ? partial(getter(castImmutable(get()))) : partial;
            set(
                produce<T>(draft => {
                    const childDraft = getter(draft);
                    if (replace ?? false) {
                        if (Array.isArray(nextState) && Array.isArray(childDraft)) {
                            childDraft.length = 0;
                            childDraft.push(...nextState);
                        } else {
                            for (const key in childDraft) {
                                if (Object.hasOwnProperty.call(childDraft, key)) {
                                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                                    delete childDraft[key];
                                }
                            }
                            Object.assign(childDraft, nextState);
                        }
                    } else {
                        Object.assign(childDraft, nextState);
                    }
                }),
            );
        },
        subscribe: listener =>
            api.subscribe((state, prevState) =>
                listener(getter(castImmutable(state)), getter(castImmutable(prevState))),
            ),
        destroy: () => {
            throw new Error('Do not use destroy(), use unsubscribe returned by subscribe().');
        },
    });
}

function createStore<T, A extends object>(api: StoreApi<T>, getter: Getter<T, A>): StoreApi<A> {
    return creator(getter)(api.setState, api.getState, api);
}

function createState<T, A extends object>(api: StoreApi<T>, getter: Getter<T, A>, f: StateCreator<A>): A {
    const store = createStore(api, getter);
    return f(store.setState, store.getState, store);
}

function createNibble<T, A extends object>(api: StoreApi<T>, getter: Getter<T, A>): Nibble<A> {
    return ((f?: StateCreator<A>) => (f ? createState(api, getter, f) : createStore(api, getter))) as Nibble<A>;
}

function createRecipe<T, A extends object>(getter: Getter<T, A>): Recipe<T, A> {
    return ((api: StoreApi<T>, f?: StateCreator<A>) =>
        f ? createState(api, getter, f) : createStore(api, getter)) as Recipe<T, A>;
}

/* eslint-disable jsdoc/check-param-names */
/**
 *
 * Defines a nibble.
 *
 * A nibble is a function that creates or links to a piece of a larger state.
 * The child state can then be shared with other parts of the application without exposing the parent state.
 *
 * Usage:
 * ```ts
 * nibble(parentStore)(getter);
 * nibble<ParentState>()(getter);
 * ```
 *
 * To define a nibble, you need to provide the following:
 *  - The `parentStore` api or the `ParentState` type to create a recipe
 *  - A `getter` that extracts the nibble's state from the parent state
 *
 * In the recipe mode, the parent api is provided when creating the state or store.
 *
 * Example:
 * ```ts
 * const nib = nibble(parentStore)(getter); // Nibble<ChildState>
 * const state = nib((set, get, api) => ({...})); // ChildState
 * const store = nib(); // StoreApi<ChildState>
 * ```
 * As recipe:
 * ```ts
 * const nib = nibble<ParentState>()(getter); // Recipe<ParentState, ChildState>
 * const state = nib(parentStore, (set, get, api) => ({...})); // ChildState
 * const store = nib(parentStore); // StoreApi<ChildState>
 * ```
 *
 * The store `api`, `get` and `set` are simple wrappers operating on the parent store.
 * It is perfectly fine to create multiple store instances from the same nibble and parent store.
 *
 * @template T The type of the parent state. Must be provided when creating a recipe.
 * @param api The parent store api. Optional, omit to create a recipe.
 * @param getter A function that extracts the nibble from the parent state, e.g. `state => state.child`.
 * @returns A nibble or recipe.
 */
const nibble: CreateNibble = (<T>(api?: StoreApi<T>) =>
    api ? <A extends object>(getter: Getter<T, A>) => createNibble(api, getter) : createRecipe) as CreateNibble;

export default nibble;
