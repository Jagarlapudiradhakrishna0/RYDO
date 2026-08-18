import Constants from 'expo-constants';

type NetworkExtra = {
  apiUrl?: string;
  socketUrl?: string;
};

const extra =
  (Constants.expoConfig?.extra as NetworkExtra | undefined) || {};

const localIpPattern =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/;

const trimValue = (
  value?: string
) => value?.trim() || '';

const stripTrailingSlash = (
  value: string
) => value.replace(/\/+$/, '');

const envApiUrl =
  trimValue(process.env.EXPO_PUBLIC_API_URL);

const envSocketUrl =
  trimValue(process.env.EXPO_PUBLIC_SOCKET_URL);

const extraApiUrl =
  trimValue(extra.apiUrl);

const extraSocketUrl =
  trimValue(extra.socketUrl);

const configuredApiUrl =
  envApiUrl || extraApiUrl;

const configuredSocketUrl =
  envSocketUrl ||
  extraSocketUrl ||
  configuredApiUrl;

if (!configuredApiUrl) {
  console.log(
    'RYDO: EXPO_PUBLIC_API_URL is not configured. Set it to your public HTTPS backend URL.'
  );
}

const isSecureHttps = (
  value: string
) => /^https:\/\//i.test(value);

const getHostname = (
  value: string
) => {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
};

const apiHost =
  getHostname(configuredApiUrl);

if (
  configuredApiUrl &&
  !isSecureHttps(configuredApiUrl)
) {
  console.log(
    'RYDO: API URL should use HTTPS for real-device connectivity:',
    configuredApiUrl
  );
}

if (
  apiHost &&
  localIpPattern.test(apiHost)
) {
  console.log(
    'RYDO: API URL points to a local/private host. Use a public HTTPS backend URL for cross-network phones:',
    configuredApiUrl
  );
}

export const API_BASE_URL =
  stripTrailingSlash(configuredApiUrl);

export const API_URL =
  API_BASE_URL;

export const SOCKET_URL =
  stripTrailingSlash(
    configuredSocketUrl
  );
