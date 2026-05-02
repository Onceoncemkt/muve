import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const codigo = searchParams.get('codigo') || 'MUVET20-XXXXXX'
  const ciudad = searchParams.get('ciudad') || 'Tulancingo'

  return new ImageResponse(
    (
      <div style={{
        width: '1080px',
        height: '1920px',
        background: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        padding: '80px',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '500px',
          height: '500px',
          background: '#E8FF47',
          clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
        }} />

        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '350px',
          height: '350px',
          background: '#6B4FE8',
          clipPath: 'polygon(0 100%, 100% 100%, 0 0)',
        }} />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          zIndex: 1,
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: '#E8FF47',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0A0A0A',
            fontSize: '40px',
            fontWeight: 700,
          }}>
            MV
          </div>
          <span style={{
            color: '#E8FF47',
            fontSize: '52px',
            fontWeight: 700,
            letterSpacing: '4px',
          }}>
            MUVET
          </span>
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          zIndex: 1,
        }}>
          <p style={{
            color: '#999',
            fontSize: '36px',
            letterSpacing: '6px',
            margin: 0,
            marginBottom: '40px',
          }}>
            SOY PARTE DEL CLUB
          </p>

          <p style={{
            color: 'white',
            fontSize: '72px',
            fontWeight: 600,
            margin: 0,
            marginBottom: '60px',
            lineHeight: 1.1,
          }}>
            Aparté mi 20%<br />de descuento
          </p>

          <div style={{
            background: '#E8FF47',
            padding: '50px 60px',
            borderRadius: '24px',
            marginBottom: '50px',
          }}>
            <p style={{
              color: '#0A0A0A',
              fontSize: '28px',
              letterSpacing: '4px',
              margin: 0,
              marginBottom: '20px',
            }}>
              MI CÓDIGO
            </p>
            <p style={{
              color: '#0A0A0A',
              fontSize: '64px',
              fontWeight: 700,
              letterSpacing: '6px',
              margin: 0,
            }}>
              {codigo}
            </p>
          </div>

          <p style={{
            color: '#888',
            fontSize: '32px',
            margin: 0,
            lineHeight: 1.4,
          }}>
            Tápalo si vas a subirlo<br />a tus stories 😉
          </p>
        </div>

        <div style={{
          textAlign: 'center',
          zIndex: 1,
        }}>
          <p style={{
            color: '#E8FF47',
            fontSize: '40px',
            fontWeight: 600,
            margin: 0,
          }}>
            muvet.mx
          </p>
          <p style={{
            color: '#666',
            fontSize: '28px',
            margin: 0,
            marginTop: '12px',
          }}>
            {ciudad} · Pachuca · Ensenada · Tijuana
          </p>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
    }
  )
}
