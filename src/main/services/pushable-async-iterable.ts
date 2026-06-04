export class PushableAsyncIterable<T> implements AsyncIterable<T> {
  private values: T[] = [];
  private pendingResolve: ((value: IteratorResult<T>) => void) | null = null;
  private isDone = false;
  private error: Error | null = null;

  push(item: T): void {
    if (this.isDone || this.error) return;
    if (this.pendingResolve) {
      this.pendingResolve({ value: item, done: false });
      this.pendingResolve = null;
    } else {
      this.values.push(item);
    }
  }

  end(): void {
    if (this.isDone) return;
    this.isDone = true;
    if (this.pendingResolve) {
      this.pendingResolve({ value: undefined, done: true });
      this.pendingResolve = null;
    }
  }

  propagateError(err: Error): void {
    this.error = err;
    this.isDone = true;
    if (this.pendingResolve) {
      this.pendingResolve({ value: undefined, done: true });
      this.pendingResolve = null;
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    const self = this;
    return {
      async next(): Promise<IteratorResult<T>> {
        if (self.error) throw self.error;
        if (self.values.length > 0) {
          const value = self.values.shift()!;
          return { value, done: false };
        }
        if (self.isDone) {
          return { value: undefined, done: true };
        }
        return new Promise<IteratorResult<T>>((resolve) => {
          self.pendingResolve = resolve;
        });
      },
    };
  }
}
