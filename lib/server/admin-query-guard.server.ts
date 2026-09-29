export class AdminQueryTimeoutError extends Error {
  readonly code = "ADMIN_DB_QUERY_TIMEOUT";

  constructor(readonly timeoutMs: number) {
    super(`Consulta administrativa excedeu ${String(timeoutMs)}ms`);
    this.name = "AdminQueryTimeoutError";
  }
}

export interface AdminQueryGuard {
  run<T>(
    operation: () => PromiseLike<T>,
    onTimeout?: () => void,
  ): Promise<T>;
}

function assertTimeout(timeoutMs: number): void {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs deve ser um inteiro positivo");
  }
}

async function withDeadline<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new AdminQueryTimeoutError(timeoutMs));
      try {
        onTimeout?.();
      } catch {
        // O timeout original continua sendo a causa exposta ao chamador.
      }
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(operation), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Postgres.js + poolers de transação podem deixar queries pendentes em cenários
 * de socket/pool. O guard garante uma operação por conexão max:1 e um deadline
 * de aplicação que independe do connect_timeout do driver.
 */
export function createAdminQueryGuard(timeoutMs: number): AdminQueryGuard {
  assertTimeout(timeoutMs);
  let tail = Promise.resolve();

  return {
    async run<T>(operation: () => PromiseLike<T>, onTimeout?: () => void): Promise<T> {
      const previous = tail;
      let release = (): void => undefined;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });

      await previous;
      try {
        return await withDeadline(operation(), timeoutMs, onTimeout);
      } finally {
        release();
      }
    },
  };
}
