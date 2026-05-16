import { SharedArray } from 'k6/data';

/** Defines a generic data set interface providing sequential, random, and VU-based access. */
export interface IDataSet<T> {
    all(): readonly T[];
    random(): T;
    next(): T;
    pickByVU(): T;
    size: number;
}

/** Structural type mirroring the k6 SharedArray interface. Used since @types/k6 does not export the class. */
type SharedArrayLike<T> = { readonly length: number; readonly [index: number]: T };

/**
 * Wraps a k6 SharedArray with convenience access methods (random, round-robin, VU-pinned).
 * Data is shared read-only across all VUs, providing significant memory savings at scale.
 */
export class SharedDataSet<T> implements IDataSet<T> {
    private arr: SharedArrayLike<T>;
    private rrCounter = 0;

    /**
     * @param name   Unique identifier for the SharedArray (used by k6 for resource tracking)
     * @param loader Factory function that returns the data array, called once during initialization
     */
    constructor(name: string, loader: () => T[]) {
        this.arr = new SharedArray<T>(name, loader) as unknown as SharedArrayLike<T>;
    }

    /** Returns all entries as a read-only array. */
    all(): readonly T[] {
        return this.arr as unknown as readonly T[];
    }

    /** Returns a uniformly random entry from the data set. */
    random(): T {
        if (this.arr.length === 0) throw new Error('Data set is empty');
        return this.arr[Math.floor(Math.random() * this.arr.length)];
    }

    /** Returns the next entry in round-robin order across all calls (global counter). */
    next(): T {
        if (this.arr.length === 0) throw new Error('Data set is empty');
        return this.arr[this.rrCounter++ % this.arr.length];
    }

    /** Returns the entry pinned to the current VU index, ensuring each VU gets a consistent item. */
    pickByVU(): T {
        if (this.arr.length === 0) throw new Error('Data set is empty');
        const vu = (globalThis as { __VU?: number }).__VU || 1;
        return this.arr[(vu - 1) % this.arr.length];
    }

    /** Total number of entries in the data set. */
    get size(): number {
        return this.arr.length;
    }
}
