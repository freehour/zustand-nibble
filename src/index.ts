/* eslint-disable jsdoc/check-param-names */
import type { Draft, Immutable } from 'immer';
import { castImmutable, produce } from 'immer';
import type { StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand';

type Getter<T, A> = (state: Immutable<T>) => A;
type Updater<T> = (draft: Draft<T>) => void;
type Setter<T, A> = (nextState: A | Partial<A>) => T | Partial<T> | Updater<T>;
type WithSetter<T, A, R> = A extends object ? (setter?: Setter<T, A>) => R : (setter: Setter<T, A>) => R;

interface Nibble<A> {
    createState: <
        Mps extends [StoreMutatorIdentifier, unknown][] = [],
        Mcs extends [StoreMutatorIdentifier, unknown][] = [],
    >(
        f: StateCreator<A, Mps, Mcs>,
    ) => A;

    createStore: () => StoreApi<A>;
}

interface NibbleRecipe<T, A> {
    createState: <
        Mps extends [StoreMutatorIdentifier, unknown][] = [],
        Mcs extends [StoreMutatorIdentifier, unknown][] = [],
    >(
        api: StoreApi<T>,
        f: StateCreator<A, Mps, Mcs>,
    ) => A;

    createStore: (api: StoreApi<T>) => StoreApi<A>;
}

function creator<T, A>(getter: Getter<T, A>, setter: Setter<T, A>): StateCreator<T, [], [], StoreApi<A>> {
    return (set, get, api) => ({
        getState: () => getter(castImmutable(get())),
        getInitialState: () => getter(castImmutable(api.getInitialState())),
        setState: nextState => {
            const nextStateOrUpdater = setter(
                nextState instanceof Function ? nextState(getter(castImmutable(get()))) : nextState,
            );
            set(nextStateOrUpdater instanceof Function ? produce<T>(nextStateOrUpdater) : nextStateOrUpdater);
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

function createStore<T, A>(api: StoreApi<T>, getter: Getter<T, A>, setter: Setter<T, A>): StoreApi<A> {
    return creator(getter, setter)(api.setState, api.getState, api);
}

function createState<T, A>(api: StoreApi<T>, getter: Getter<T, A>, setter: Setter<T, A>, f: StateCreator<A>): A {
    const store = createStore(api, getter, setter);
    return f(store.setState, store.getState, store);
}

function objectUpdater<T, A>(getter: Getter<T, A>): Setter<T, A> {
    return nextState => (draft: Draft<T>) => void Object.assign(getter(draft) as object, nextState);
}

function createNibbleWithSetter<T, A>(
    api: StoreApi<T>,
    getter: Getter<T, A>,
    setter: Setter<T, A> = objectUpdater(getter),
): Nibble<A> {
    return {
        createState: f => createState(api, getter, setter, f as StateCreator<A>),
        createStore: () => createStore(api, getter, setter),
    };
}

function createNibbleRecipeWithSetter<T, A>(
    getter: Getter<T, A>,
    setter: Setter<T, A> = objectUpdater(getter),
): NibbleRecipe<T, A> {
    return {
        createState: (api, f) => createState(api, getter, setter, f as StateCreator<A>),
        createStore: api => createStore(api, getter, setter),
    };
}

function createNibbleWithGetter<T, A>(api: StoreApi<T>, getter: Getter<T, A>): WithSetter<T, A, Nibble<A>> {
    return ((setter: Setter<T, A> | undefined) => createNibbleWithSetter(api, getter, setter)) as WithSetter<
        T,
        A,
        Nibble<A>
    >;
}

function createNibbleRecipeWithGetter<T, A>(getter: Getter<T, A>): WithSetter<T, A, NibbleRecipe<T, A>> {
    return ((setter: Setter<T, A> | undefined) => createNibbleRecipeWithSetter(getter, setter)) as WithSetter<
        T,
        A,
        NibbleRecipe<T, A>
    >;
}

interface CreateNibble {
    <T>(api: StoreApi<T>): <A>(getter: Getter<T, A>) => WithSetter<T, A, Nibble<A>>;
    <T>(): <A>(getter: Getter<T, A>) => WithSetter<T, A, NibbleRecipe<T, A>>;
}

/**
 * Defines a nibble.
 * A nibble is a small piece of a larger state that can be shared with other parts of the application without exposing the entire state.
 *
 * To define a nibble, you need to provide a getter function that extracts the nibble from the parent state
 * and a setter function that updates the nibble in the parent state.
 * The setter function can be omitted if the nibble is an object, in which case the nibble will be updated by merging its state using Object.assign.
 *
 * The nibble can be defined with a parent store or as a recipe, in which case the parent store must be provided when creating a state/store instance.
 * To create a state instance, call `createState` with your state creator function.
 * To create a store api, call `createStore`. The store api (as well as get(), set() passed to the state creator) are simple wrappers operating on the parent store.
 * Thus, it is perfectly fine to create multiple store instances from the same nibble and parent store.
 *
 *
 * Typescript Usage:
 * ```ts
 * nibble(parentStore)(getter)(setter?);
 * // or as recipe
 * nibble<ParentState>()(getter)(setter?);
 * ```
 *
 * @template T The type of the parent state. Must be provided when creating a recipe.
 * @param api The parent store api. Optional, omit to create a recipe.
 * @param getter A function that extracts the nibble from the parent state, e.g. `state => state.child`.
 * @param setter A function that updates the nibble in the parent state. Can be omitted if the nibble is an object. E.g. `nextState => draft => void Object.assign(draft.child, nextState)`.
 * @returns A nibble or nibble recipe.
 */
export const nibble: CreateNibble = (<T>(api?: StoreApi<T>) =>
    api
        ? <A>(getter: Getter<T, A>) => createNibbleWithGetter(api, getter)
        : createNibbleRecipeWithGetter) as CreateNibble;
