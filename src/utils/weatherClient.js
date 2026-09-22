import * as Location from 'expo-location';

const API_KEY = 'YOUR_OPENWEATHER_KEY';
const BASE = 'https://api.openweathermap.org/data/2.5';

export async function getCurrentWeather() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const loc = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = loc.coords;

  const res = await fetch(
    `${BASE}/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`
  );
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();

  return {
    temp: Math.round(data.main.temp),
    feelsLike: Math.round(data.main.feels_like),
    humidity: data.main.humidity,
    condition: data.weather[0].main,       // 'Clear', 'Rain', etc.
    description: data.weather[0].description,
    icon: data.weather[0].icon,
    city: data.name,
  };
}

export async function getForecast() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const loc = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = loc.coords;

  const res = await fetch(
    `${BASE}/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`
  );
  if (!res.ok) throw new Error('Forecast fetch failed');
  const data = await res.json();

  // Group 3-hour intervals into daily summaries
  const byDay = {};
  data.list.forEach((entry) => {
    const date = entry.dt_txt.split(' ')[0];
    if (!byDay[date]) byDay[date] = [];
    byDay[date].push(entry);
  });

  return Object.entries(byDay).slice(0, 5).map(([date, entries]) => {
    const temps = entries.map((e) => e.main.temp);
    const conditions = entries.map((e) => e.weather[0].main);
    return {
      date,
      tempMin: Math.round(Math.min(...temps)),
      tempMax: Math.round(Math.max(...temps)),
      condition: conditions.includes('Rain') ? 'Rain' : conditions[0],
      rainChance: entries.filter((e) => e.weather[0].main === 'Rain').length / entries.length,
    };
  });
}