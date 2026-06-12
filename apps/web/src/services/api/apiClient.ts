const DEFAULT_API_BASE_URL = "http://localhost:3001";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

export class ApiError extends Error {
  status: number;
  responseText: string;

  constructor(message: string, status: number, responseText: string) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.responseText = responseText;
  }
}

export async function apiGet<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(buildApiUrl(path));

  if (!response.ok) {
    const responseText = await response.text();

    throw new ApiError(`API request failed with status ${response.status}.`, response.status, responseText);
  }

  return response.json() as Promise<TResponse>;
}

function buildApiUrl(path: string): string {
  const normalizedBaseUrl = apiBaseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}
