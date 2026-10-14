
const BASE_URL = 'https://psgc.gitlab.io/api';
const TIMEOUT_MS = 12000;

const cache = new Map();

const byName = (a, b) => a.name.localeCompare(b.name);

async function getJson(path) {
  if (cache.has(path)) return cache.get(path);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`PSGC request failed (${res.status})`);
    const data = await res.json();
    const list = (Array.isArray(data) ? data : [])
      .map((item) => ({ code: item.code, name: item.name, regionName: item.regionName }))
      .sort(byName);
    cache.set(path, list);
    return list;
  } finally {
    clearTimeout(timer);
  }
}

export const fetchRegions = () => getJson('/regions/');
export const fetchProvinces = (regionCode) => getJson(`/regions/${regionCode}/provinces/`);
// Used for regions without provinces (e.g. NCR / Metro Manila).
export const fetchRegionCities = (regionCode) => getJson(`/regions/${regionCode}/cities-municipalities/`);
export const fetchProvinceCities = (provinceCode) => getJson(`/provinces/${provinceCode}/cities-municipalities/`);
export const fetchBarangays = (cityCode) => getJson(`/cities-municipalities/${cityCode}/barangays/`);