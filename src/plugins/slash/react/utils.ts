export type CancelablePromise<T> = {
  cancel: () => void;
  promise: Promise<T>;
};

export function setCancelablePromise<T>(
  executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void,
): CancelablePromise<T> {
  let isCancelled = false;

  const promise = new Promise<T>((resolve, reject) => {
    executor(
      (value) => {
        if (!isCancelled) {
          resolve(value);
        }
      },
      (reason) => {
        if (!isCancelled) {
          reject(reason);
        }
      },
    );
  });

  return {
    cancel: () => {
      isCancelled = true;
    },
    promise,
  };
}
