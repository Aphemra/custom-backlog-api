interface ApiErrorPayload {
  readonly error?: unknown;
  readonly message?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "The local API could not be reached. Make sure npm run dev is still running.",
    );
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    const code =
      typeof errorPayload?.error === "string" ? errorPayload.error : "request_failed";
    const message =
      typeof errorPayload?.message === "string"
        ? errorPayload.message
        : `The local API returned HTTP ${response.status}.`;

    throw new ApiError(response.status, code, message);
  }

  return payload as T;
}

export async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  let response: Response;

  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "The local API could not be reached. Make sure npm run dev is still running.",
    );
  }

  if (!response.ok) {
    const payload = (await readResponsePayload(response)) as ApiErrorPayload | null;
    const code = typeof payload?.error === "string" ? payload.error : "request_failed";
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : `The local API returned HTTP ${response.status}.`;

    throw new ApiError(response.status, code, message);
  }
}
