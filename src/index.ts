import type { Draft } from 'immer';
import { produce } from 'immer';
import { isFunction } from 'is-runtype';
import type { Mutate, StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand';


export type Getter<T, A> = (state: T) => A;
export type Setter<T> = (updater: (draft: Draft<T>) => void) => void;

export type Nibble<A extends object> = <Mcs extends [StoreMutatorIdentifier, unknown][] = []>(
    f: StateCreator<A, [], Mcs>,
) => A;

export type Recipe<T, A extends object> = <Mps extends [StoreMutatorIdentifier, unknown][] = [], Mcs extends [StoreMutatorIdentifier, unknown][] = []>(
    api: Mutate<StoreApi<T>, Mps>,
    setter?: Setter<T>,
) => (f: StateCreator<A, [], Mcs>) => A;

interface CreateNibble {
    <T, Mps extends [StoreMutatorIdentifier, unknown][] = []>(api: Mutate<StoreApi<T>, Mps>): <A extends object>(getter: Getter<T, A>, setter?: Setter<T>) => Nibble<A>;
    <T>(): <A extends object>(getter: Getter<T, A>) => Recipe<T, A>;
}

class NibbleStore<T, Mps extends [StoreMutatorIdentifier, unknown][], A extends object> implements StoreApi<A> {
    private readonly api: Mutate<StoreApi<T>, Mps>;
    private readonly getter: Getter<T, A>;
    private readonly setter: Setter<T>;

    constructor(
        api: Mutate<StoreApi<T>, Mps>,
        getter: Getter<T, A>,
        setter: Setter<T>,
    ) {
        this.api = api;
        this.getter = getter;
        this.setter = setter;
    }

    getState(): A {
        return this.getter(this.api.getState());
    }

    getInitialState(): A {
        return this.getter(this.api.getInitialState());
    }

    subscribe(listener: (state: A, prevState: A) => void): () => void {
        return this.api.subscribe((state, prevState) => listener(
            this.getter(state),
            this.getter(prevState),
        ));
    }

    setState(partial: Partial<A> | ((state: A) => Partial<A>), replace?: boolean): void {
        this.setter(draft => {
            const childDraft = this.getter(draft as T);
            const nextState = isFunction(partial) ? partial(childDraft) : partial;
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
        });
    }

    createState(f: StateCreator<A>): A {
        return f(this.setState.bind(this), this.getState.bind(this), this);
    }
}

function createState<T, Mps extends [StoreMutatorIdentifier, unknown][], A extends object>(
    api: Mutate<StoreApi<T>, Mps>,
    getter: Getter<T, A>,
    setter: Setter<T>,
    f: StateCreator<A>,
): A {
    const store = new NibbleStore(api, getter, setter);
    return store.createState(f);
}

function createNibble<T, Mps extends [StoreMutatorIdentifier, unknown][], A extends object>(
    api: Mutate<StoreApi<T>, Mps>,
    getter: Getter<T, A>,
    setter: Setter<T>,
): Nibble<A> {
    // we can use StateCreator<A> here (omitting Mos) because it doesn't change the store api, and we don't need to know the child mutators
    return ((f: StateCreator<A>) => createState(api, getter, setter, f)) as Nibble<A>;
}

function createRecipe<T, A extends object>(getter: Getter<T, A>): Recipe<T, A> {
    // again omitting Mos/Mcs
    return (<Mps extends [StoreMutatorIdentifier, unknown][]>(
        api: Mutate<StoreApi<T>, Mps>,
        setter: Setter<T> = updater => (api as StoreApi<T>).setState(produce<T>(updater)),
    ) => (f: StateCreator<A>) => createState(api, getter, setter, f)) as Recipe<T, A>;
}

/**
 *
 * Defines a nibble.
 *
 * A nibble is a function that creates and links a piece of a larger state.
 * This allows to split a zustand store into smaller pieces, each with its own state and actions.
 *
 * Usage:
 * ```ts
 * nibble(api)(getter, setter?);
 * nibble<ParentState>()(getter)(api, setter?);
 * ```
 *
 * To define a nibble, you need to provide the following:
 *  - The parent store `api` or the `ParentState` type
 *  - A `getter` that extracts the child's state from the parent state
 *  - A custom `setter` for the parent state, required for middlewares mutating `setState`
 *
 * The second overload creates a recipe that can be applied to multiple parent api's.
 *
 * @example
 * ```ts
 * const useParent = create<ParentState>()((set, get, api) => ({
 *      name: 'John Doe',
 *      age: 42,
 *      child: nibble(api)(state => state.child)(set => ({
 *          name: 'Joe Doe',
 *          age: 10,
 *          birthday: () => set(state => ({ age: state.age + 1 })),
 *      })),
 *      birthday: () => set(state => ({ age: state.age + 1 })),
 * }));
 * ```
 *
 * As recipe:
 * @example
 * ```ts
 * const createChild = nibble<ParentState>()(state => state.child);
 *
 * const useDad = create<ParentState>()((set, get, api) => ({
 *     name: 'John Doe',
 *     age: 42,
 *     child: createChild(api)(createJoe),
 *     birthday: () => set(state => ({ age: state.age + 1 })),
 * }));
 *
 * const useMom = create<ParentState>()((set, get, api) => ({
 *     name: 'Jane Doe',
 *     age: 37,
 *     child: createChild(api)(createJoe),
 *     birthday: () => set(state => ({ age: state.age + 1 })),
 * }));
 * ```
 *
 * MIDDLEWARES
 *
 * You can use any middleware on the child state by applying it to your state creator:
 * @example
 * ```ts
 * const nib = nibble(api)(getter); // Nibble<ChildState>
 * const state = nib(immer(
 *      (set, get, api) => ({...})
 * )); // ChildState
 * ```
 *
 * When using middlewares that mutate the set function of the parent store,
 * you may need to provide a custom setter.
 *
 * For `immer` this is just the `set` function.
 * @example
 * ```ts
 * const useParent = create<ParentState>()(immer((set, get, api) => ({
 *      name: 'John Doe',
 *      age: 42,
 *      child: nibble(api)(state => state.child, set)(createJoe),
 *      birthday: () => set(draft => { draft.age += 1 }),
 * })));
 * ```
 *
 * @template T The type of the parent state. Must be provided when creating a recipe.
 * @template Mps The list of mutators applied to the parent store.
 * @param api The parent store api. Optional, omit to create a recipe.
 * @param getter A function that extracts the nibble from the parent state, e.g. `state => state.child`.
 * @param setter A function that applies a draft updater to the parent state, e.g. `produce`.
 * @returns A nibble or recipe.
 */
const nibble: CreateNibble = (
    <T, Mps extends [StoreMutatorIdentifier, unknown][] = []>(
        api?: Mutate<StoreApi<T>, Mps>,
    ) => api
        ? <A extends object>(
            getter: Getter<T, A>,
            setter: Setter<T> = updater => (api as StoreApi<T>).setState(produce<T>(updater)),
        ) => createNibble(api, getter, setter)
        : createRecipe
) as CreateNibble;

export default nibble;
