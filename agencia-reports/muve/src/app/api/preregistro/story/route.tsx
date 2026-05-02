import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const codigo = searchParams.get('codigo') || 'MUVET20-XXXXXX'

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
          justifyContent: 'space-between',
        }}>
          <div style={{
            position: 'absolute',
            top: '-120px',
            right: '-120px',
            width: '420px',
            height: '420px',
            background: '#E8FF47',
            borderRadius: '80px',
            transform: 'rotate(12deg)',
          }} />

          <div style={{
            position: 'absolute',
            bottom: '-80px',
            left: '-90px',
            width: '280px',
            height: '280px',
            background: '#6B4FE8',
            borderRadius: '60px',
            transform: 'rotate(-18deg)',
          }} />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
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
            <div style={{
              color: '#E8FF47',
              fontSize: '52px',
              fontWeight: 700,
              letterSpacing: '4px',
            }}>
              MUVET
            </div>
          </div>

          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}>
            <div style={{
              color: '#E8FF47',
              fontSize: '36px',
              letterSpacing: '6px',
              margin: 0,
              marginBottom: '20px',
              fontWeight: 500,
            }}>
              YA SOY PARTE DEL
            </div>
            
            <div style={{
              color: 'white',
              fontSize: '96px',
              fontWeight: 700,
              margin: 0,
              marginBottom: '60px',
              lineHeight: 1.1,
            }}>
              #MUVETClub
            </div>

            <div style={{
              background: '#E8FF47',
              padding: '50px 60px',
              borderRadius: '24px',
              marginBottom: '50px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              <div style={{
                color: '#0A0A0A',
                fontSize: '28px',
                letterSpacing: '4px',
                margin: 0,
                marginBottom: '20px',
              }}>
                MI CÓDIGO
              </div>
              <div style={{
                color: '#0A0A0A',
                fontSize: '64px',
                fontWeight: 700,
                letterSpacing: '6px',
                margin: 0,
              }}>
                {codigo}
              </div>
            </div>

            <div style={{
              color: '#888',
              fontSize: '32px',
              margin: 0,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}>
              {'Tapa tu código si vas\na subirlo a tus stories'}
            </div>
          </div>

          <div style={{
            textAlign: 'center',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <div style={{
              color: '#E8FF47',
              fontSize: '40px',
              fontWeight: 600,
              margin: 0,
            }}>
              muvet.mx
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
      }
    )
  } catch (err: any) {
    console.error('[story] Error:', err)
    return new Response(
      `Error generando imagen: ${err?.message ?? 'error desconocido'}\n\nStack: ${err?.stack ?? 'sin stack'}`,
      { status: 500 }
    )
  }
}
