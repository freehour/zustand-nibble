import type { Draft } from 'immer';
import { castDraft, produce } from 'immer';
import type { StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand';

type Getter<T, A> = (state: T) => A;
type Updater<T> = (draft: Draft<T>) => void;
type Setter<T, A> = (nextState: A | Partial<A>, replace?: boolean) => T | Partial<T> | Updater<T>;
type WithSetter<T, A, R> = A extends object ? (setter?: Setter<T, A>) => R : (setter: Setter<T, A>) => R;

interface Nibble<A> {
    (): StoreApi<A>;
    <Mps extends [StoreMutatorIdentifier, unknown][] = [], Mcs extends [StoreMutatorIdentifier, unknown][] = []>(
        f: StateCreator<A, Mps, Mcs>,
    ): A;
}

interface Recipe<T, A> {
    (api: StoreApi<T>): StoreApi<A>;
    <Mps extends [StoreMutatorIdentifier, unknown][] = [], Mcs extends [StoreMutatorIdentifier, unknown][] = []>(
        api: StoreApi<T>,
        f: StateCreator<A, Mps, Mcs>,
    ): A;
}

interface CreateNibble {
    <T>(api: StoreApi<T>): <A>(getter: Getter<T, A>) => WithSetter<T, A, Nibble<A>>;
    <T>(): <A>(getter: Getter<T, A>) => WithSetter<T, A, Recipe<T, A>>;
}

function creator<T, A>(getter: Getter<T, A>, setter: Setter<T, A>): StateCreator<T, [], [], StoreApi<A>> {
    return (set, get, api) => ({
        getState: () => getter(get()),
        getInitialState: () => getter(api.getInitialState()),
        setState: (nextState, replace) => {
            const nextStateOrUpdater = setter(
                nextState instanceof Function ? nextState(getter(get())) : nextState,
                replace,
            );
            set(nextStateOrUpdater instanceof Function ? produce<T>(nextStateOrUpdater) : nextStateOrUpdater);
        },
        subscribe: listener => api.subscribe((state, prevState) => listener(getter(state), getter(prevState))),
        destroy: () => {
            throw new Error('Do not use destroy(), use unsubscribe returned by subscribe().');
        },
    });
}

function createStore<T, A>(api: StoreApi<T>, getter: Getter<T, A>, setter: Setter<T, A>): StoreApi<A> {
    return creator(getter, setter)(api.setState, api.getState, api);
}

function createState<T, A>(api: StoreApi<T>, getter: Getter<T, A>, setter: Setter<T, A>, f: StateCreator<A>): A {
    const store = createStore(api, getter, setter);
    return f(store.setState, store.getState, store);
}

function objectUpdater<T, A>(getter: Getter<T, A>): Setter<T, A> {
    return (nextState, replace) => (draft: Draft<T>) => {
        const childDraft = castDraft(getter(draft as T));
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
                Object.assign(childDraft as object, nextState);
            }
        } else {
            Object.assign(childDraft as object, nextState);
        }
    };
}

function createNibbleWithSetter<T, A>(
    api: StoreApi<T>,
    getter: Getter<T, A>,
    setter: Setter<T, A> = objectUpdater(getter),
): Nibble<A> {
    return ((f?: StateCreator<A>) =>
        f ? createState(api, getter, setter, f) : createStore(api, getter, setter)) as Nibble<A>;
}

function createNibbleRecipeWithSetter<T, A>(
    getter: Getter<T, A>,
    setter: Setter<T, A> = objectUpdater(getter),
): Recipe<T, A> {
    return ((api: StoreApi<T>, f?: StateCreator<A>) =>
        f ? createState(api, getter, setter, f) : createStore(api, getter, setter)) as Recipe<T, A>;
}

function createNibbleWithGetter<T, A>(api: StoreApi<T>, getter: Getter<T, A>): WithSetter<T, A, Nibble<A>> {
    return ((setter: Setter<T, A> | undefined) => createNibbleWithSetter(api, getter, setter)) as WithSetter<
        T,
        A,
        Nibble<A>
    >;
}

function createNibbleRecipeWithGetter<T, A>(getter: Getter<T, A>): WithSetter<T, A, Recipe<T, A>> {
    return ((setter: Setter<T, A> | undefined) => createNibbleRecipeWithSetter(getter, setter)) as WithSetter<
        T,
        A,
        Recipe<T, A>
    >;
}

/* eslint-disable jsdoc/check-param-names */
/**
 *
 * Defines a nibble.
 *
 * A nibble is a function that creates a piece of a larger state.
 * This state can then be shared with other parts of the application without exposing the parent state.
 *
 * Usage:
 * ```ts
 * nibble(parentStore)(getter)(setter?);
 * nibble<ParentState>()(getter)(setter?);
 * ```
 *
 * To define a nibble, you need to provide the following:
 *  - A `getter` that extracts the nibble's state from the parent state
 *  - A `setter` that updates the nibble's state in the parent state.
 *    Can be omitted if the nibble is an object, in which case `Object.assign` is used to merge the state.
 *  - Either the `parentStore` api or the `ParentState` type to create a recipe.
 *
 * When using a recipe the `parentStore` is provided later when creating a state or store instance.
 *
 * Example:
 * ```ts
 * const nib = nibble(parentStore)(getter)(setter); // Nibble<ChildState>
 * const state = nib((set, get, api) => ({...})); // ChildState
 * const store = nib(); // StoreApi<ChildState>
 * ```
 * As recipe:
 * ```ts
 * const nib = nibble<ParentState>()(getter)(setter); // Recipe<ParentState, ChildState>
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
 * @param setter A function that updates the nibble in the parent state. Can be omitted if the nibble is an object. E.g. `nextState => draft => void Object.assign(draft.child, nextState)`.
 * @returns A nibble or nibble recipe.
 */
const nibble: CreateNibble = (<T>(api?: StoreApi<T>) =>
    api
        ? <A>(getter: Getter<T, A>) => createNibbleWithGetter(api, getter)
        : createNibbleRecipeWithGetter) as CreateNibble;

export default nibble;
