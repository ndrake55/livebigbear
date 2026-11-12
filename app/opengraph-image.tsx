import { ImageResponse } from 'next/og';

export const alt = 'Live Big Bear: road conditions, chain control and weather right now';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The picture shown when a page is shared in a text, on social media or in a chat. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(160deg, #12202E 0%, #1F3B57 60%, #2E5E7E 100%)',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 600, opacity: 0.85 }}>livebigbear.com</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 104, fontWeight: 800, lineHeight: 1.05 }}>Live Big Bear</div>
          <div style={{ display: 'flex', fontSize: 44, marginTop: 20, opacity: 0.92 }}>
            Roads, chain control, weather and trails, right now
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {['Hwy 330', 'Hwy 18', 'Hwy 38', 'Cameras', 'Trails', 'The lake'].map((t) => (
            <div key={t} style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', fontSize: 28 }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
