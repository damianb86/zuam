const DEFAULT_API_BASE_URL = "/api";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

export function getZuamApiUrl(path: string) {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_ZUAM_API_BASE_URL || DEFAULT_API_BASE_URL;
  const baseUrl = trimTrailingSlash(configuredBaseUrl);
  const normalizedPath = trimSlashes(path);

  if (!normalizedPath) {
    return baseUrl || DEFAULT_API_BASE_URL;
  }

  return `${baseUrl || DEFAULT_API_BASE_URL}/${normalizedPath}`;
}
