# zustand-nibble

Split a _zustand_ store into smaller pieces, called _nibbles_.
Compared to [slices](https://docs.pmnd.rs/zustand/guides/slices-pattern) which are spread at the top-level of the store, a nibble can be placed **anywhere** in the parent store.

```typescript
import { type StateCreator, create } from 'zustand';
import nibble from 'zustand-nibble';

export interface Child {
    name: string;
    age: number;
    birthday: () => void;
}

export interface Parent {
    name: string;
    age: number;
    child: Child;
    birthday: () => void;
}

const createJoe: StateCreator<Child> = set => ({
    name: 'Joe Doe',
    age: 10,
    birthday: () => set(state => ({ age: state.age + 1 })),
});

const useParent = create<Parent>()((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: nibble(api)(state => state.child)(createJoe),
    birthday: () => set(state => ({ age: state.age + 1 })),
}));
```

`nibble(api)(getter, setter?)` receives the following arguments:

- The parent store `api`
- A `getter` that extracts the child's state from the parent state
- A custom `setter` for the parent state, required for middlewares mutating `setState`

It returns a function that accepts a `StateCreator` to create the child state, similar to a _zustand_ middleware.

## Installation

### npm

```bash
npm install zustand-nibble
```

### bun

```bash
bun install zustand-nibble
```

## Why not use Immer?

`immer` and `zustand-nibble` both simplify nested state updates.

I would argue, that _immer_ is the better choice here.
In fact, _zustand-nibble_ uses _immer_ under the hood to update the parent state.

The primary use of a nibble is to **decouple the child state from the parent state**. This allows the composition of independent states into any structure, even dynamically.

In the example above, `createJoe` is independent of the parent state. It can be integrated in any store that accepts a `Child`, using a nibble to link them together. This decoupling in not possible with _immer_ alone, as it always operates on the parent state.

Naturally, `immer` and `zustand-nibble` can be used together.

## Use with middlewares

You can use any middleware on the child store by applying it to your state creator:

```typescript
const useParent = create<Parent>()((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: nibble(api)(state => state.child)(immer(set => ({ // <- apply immer middleware
        name: 'Joe Doe',
        age: 10,
        birthday: () => set(draft => { draft.age += 1 }),
    }))),
    birthday: () => set(state => ({ age: state.age + 1 })),
}));
```

If you use a middleware on the parent store that mutates the `setState` function, you may need to provide a custom setter to the nibble.

### Immer

As nibble uses _immer_ to update the parent state, you can just pass the `set` function when using the immer middleware on the parent store.
```typescript
const useParent = create<Parent>()(immer((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: nibble(api)(state => state.child, set)(createJoe), // <- pass mutated set function
    birthday: () => set(state => ({ age: state.age + 1 })),
})));
```

### Custom Setter

You have to provide a custom `setter` if the `setState` function is not compatible with the standard form:

```typescript
type SetState<T>: (nextState: (state: T) => T) => void;
```

The `setter` must be a function that accepts an `updater` working on an _immer_ draft.

```typescript
type Setter<T> = (updater: (draft: Draft<T>) => void) => void;
```

The default `setter` uses _immer_'s `produce` to update the parent state.

```typescript
const defaultSetter: Setter<T> = updater => api.setState(produce<T>(updater))
```


## Use as Recipe

The function returned by `nibble` can be used as a recipe in multiple stores.

```typescript
// Omit the api to create a recipe
const createChild = nibble<Parent>()(state => state.child); // Recipe<Parent, Child>

const useDad = create<Parent>()((set, get, api) => ({
    name: 'John Doe',
    age: 42,
    child: createChild(api)(createJoe), // call recipe
    //...
}));

const useMom = create<Parent>()((set, get, api) => ({
    name: 'Jane Doe',
    age: 37,
    child: createChild(api)(createJoe), // call recipe
    //...
}));

/* Note that the childs are separate instances.
There is no state sharing through nibbles */
```

### Arrays

Arrays are objects in JavaScript, by default the setter will merge the array using `Object.assign`. This is equvialent to how _zustand_ handles array states.

Likewise, you can use the `replace` flag to disable this merging behavior.

```typescript
childStore.setState([4, 5]); // [1, 2, 3] -> [4, 5, 3]
childStore.setState([4, 5], /*replace*/ true); // [1, 2, 3] -> [4, 5]
```

**Tip**: If possible wrap the array in an object and instead use that object as the root of your state. This applies to both _zustand_ and _zustand-nibble_.

```typescript
// Instead of this:
const useNumbers = create<number[]>(...); // zustand
nibble<number[]>()(getter); // zustand-nibble

// Do this:
interface State {
    values: number[];
}
const useNumbers = create<State>(...); // zustand
nibble<State>()(getter); // zustand-nibble
```
