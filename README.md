# zustand-nibble

Split a _zustand_ store into smaller pieces, called _nibbles_.
Compared to [slices](https://docs.pmnd.rs/zustand/guides/slices-pattern) which are spread at the top-level of the store, nibbles can be placed **anywhere** in the parent store.

```typescript
import { createStore } from 'zustand';
import nibble from 'zustand-nibble';

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

const createJoe: StateCreator<ChildState> = set => ({
    name: 'Joe Doe',
    age: 10,
    birthday: () => set(state => ({ age: state.age + 1 })),
});

const useParent = create<ParentState>()((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: nibble(api)(state => state.child)()(createJoe),
    birthday: () => set(state => ({ age: state.age + 1 })),
}));
```

`nibble(api)(getter)(setter?)` recives the following arguments:

-   The parent store `api`.
-   A `getter` that extracts the child state from the parent state.
-   A `setter` that updates the child state in the parent state.
    Optional if the child state is an object.

It returns a function that accepts a `StateCreator` to create the child state, similar to a _zustand_ middleware.

## Why not use Immer?

`immer` and `zustand-nibble` both simplify nested state updates.

I would argue, that _immer_ is the better choice here.
In fact, _zustand-nibble_ uses _immer_ under the hood to update the parent state.

The primary use of a nibble is to **decouple the child state from the parent state**. This allows the composition of independent states into any structure, even dynamically.

In the example above, `createJoe` is independent of the parent state. It can be integrated in any store that accepts a `ChildState`, using a nibble to link them together. This decoupling in not possible with _immer_ alone, as it always operates on the parent state.

Naturally, `immer` and `zustand-nibble` can be used together.

## Use as Recipe

The function returned by `nibble` can be used as a recipe in multiple stores.

```typescript
// Omit the api to create a recipe
const createChild = nibble<ParentState>()(state => state.child)();

const useDad = create<ParentState>()((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: createChild(api, createJoe), // call recipe
    //...
}));

const useMom = create<ParentState>()((set, get, api) => ({
    name: 'Jane Doe',
    age: 37,
    child: createChild(api, createJoe), // call recipe
    //...
}));

/* Note that the childs are separate instances.
There is no state sharing through nibbles */
```

## Creating a Store API

To create a store API for the child state, simply omit the state creator.

```typescript
// recipe
const createChild = nibble<ParentState>()(state => state.child)();

const parentStore = createStore<ParentState>()((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: createChild(api, createJoe), // ChildState
    //...
}));

const childStore = createChild(parentStore); // StoreApi<ChildState>
```

## Custom Setter

If the child state is an object the default setter merges the new state of the child with the current state using `Object.assign`. This should cover most use-cases, but a custom setter can be provided.

If the child state is not an object, a setter **must** be provided.
A custom setter can return a new state, or an updater function working on an _immer_ draft.

```typescript
interface ParentState {
    name: string;
    age: number;
    child: {
        name: string;
        age: number;
    };
}

// nibble links to a primitive (string) so a setter is required
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

const childStore = createChildName(parentStore); // StoreApi<string>
```

Note this is just an example for a custom setter, it is not recommended to split a primitive state into a _nibble_ or a _zustand_ store for that matter.

### Arrays

Arrays are objects in JavaScript, by default the setter will merge the array using `Object.assign`. This is equvialent to how _zustand_ handles array states.

Likewise, you can use the `replace` flag to disable this merging behavior.

```typescript
childStore.setState([4, 5]); // [1, 2, 3] -> [4, 5, 3]
childStore.setState([4, 5], /*replace*/ true); // [1, 2, 3] -> [4, 5]
```

Alternatively, a custom setter can be provided.

**Tip**: If possible wrap the array in an object and instead use that object as the root of your state. This applies to both _zustand_ and _zustand-nibble_.

```typescript
// Instead of this:
const useNumbers = create<number[]>(...); // zustand
nibble<number[]>()(getter)(setter); // zustand-nibble

// Do this:
interface State {
    values: number[];
}
const useNumbers = create<State>(...); // zustand
nibble<State>()(getter)(setter); // zustand-nibble
```
