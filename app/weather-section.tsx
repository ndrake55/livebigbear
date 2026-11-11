import { isFresh, type Weather } from '@/lib/weather';

function snowText(inches: number | null): { value: string; note: string } {
  if (inches === null) return { value: 'n/a', note: 'No snow forecast data' };
  if (inches < 0.1) return { value: 'None', note: 'None expected' };
  return { value: `${inches} in`, note: 'Forecast, next 24 hr' };
}

export function WeatherSection({ weather, place }: { weather: Weather; place: string }) {
  if (!weather.ok) {
    return (
      <section>
        <h2>Weather, {place}</h2>
        <div className="list">
          <div className="row row-static">
            <span className="row-text">
              <span className="row-name">Weather unavailable</span>
              <span className="row-sub">The National Weather Service is not responding right now.</span>
            </span>
          </div>
        </div>
      </section>
    );
  }

  const now = new Date();
  const obs = isFresh(weather.observation, now) ? weather.observation : null;
  const first = weather.periods[0];
  const snow = snowText(weather.snow24hIn);
  const temp = obs?.tempF ?? first?.temperature ?? null;
  const windValue = obs?.windMph != null ? `${obs.windMph} mph` : first?.wind.replace(/\s+[A-Z]{1,3}$/, '') || 'n/a';
  const windNote =
    obs?.windMph != null
      ? obs.windMph === 0
        ? 'Calm'
        : obs.windFrom
          ? `From the ${obs.windFrom}`
          : 'Measured'
      : 'Forecast';

  return (
    <section>
      <h2>Weather, {place}</h2>

      {weather.alerts.map((a, i) => (
        <div key={i} className="alert">
          <strong>{a.event}</strong>
          {a.headline && <span>{a.headline}</span>}
        </div>
      ))}

      <div className="tiles">
        <div className="tile">
          <span className="tile-label">{obs ? 'Now' : first?.name ?? 'Now'}</span>
          <span className="tile-value">{temp === null ? 'n/a' : `${temp}°F`}</span>
          <span className="tile-note">{obs?.text || first?.short || ''}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Snow</span>
          <span className="tile-value">{snow.value}</span>
          <span className="tile-note">{snow.note}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Wind</span>
          <span className="tile-value tile-value-small">{windValue}</span>
          <span className="tile-note">{windNote}</span>
        </div>
      </div>
      {obs && <p className="note">Temperature and wind measured at Big Bear Airport.</p>}

      <div className="list" style={{ marginTop: 10 }}>
        {weather.periods.slice(0, 4).map((p, i) => (
          <div key={i} className="row row-static">
            <span className="row-text">
              <span className="row-name">{p.name}</span>
              <span className="row-sub">{p.short}</span>
            </span>
            <span className="temp">
              {p.temperature === null ? '' : `${p.isDaytime ? 'High' : 'Low'} ${p.temperature}°`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
