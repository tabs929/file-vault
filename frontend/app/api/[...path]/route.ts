import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params)
}

async function proxyRequest(
  request: NextRequest,
  params: { path: string[] }
) {
  const path = params.path.join('/')
  const url = new URL(request.url)
  const backendUrl = `${BACKEND_URL}/${path}${url.search}`

  const headers = new Headers()

  // Forward content-type
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)

  // Forward cookies from browser to backend
  const cookie = request.headers.get('cookie')
  if (cookie) headers.set('cookie', cookie)

  // Forward origin
  headers.set('origin', request.headers.get('origin') || '')

  const init: RequestInit = {
    method: request.method,
    headers,
  }

  // Forward body for POST/PUT/DELETE
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text()
  }

  const backendResponse = await fetch(backendUrl, init)

  // Build response
  const responseHeaders = new Headers()
  responseHeaders.set('content-type', backendResponse.headers.get('content-type') || 'application/json')

  // Forward Set-Cookie from backend — rewrite to same-domain so browser stores it
  const setCookie = backendResponse.headers.get('set-cookie')
  if (setCookie) {
    // Strip domain/secure flags so cookie works on Vercel domain
    const cleanedCookie = setCookie
      .replace(/; domain=[^;]*/gi, '')
      .replace(/; secure/gi, process.env.NODE_ENV === 'production' ? '; Secure' : '')
    responseHeaders.set('set-cookie', cleanedCookie)
  }

  const body = await backendResponse.text()

  return new NextResponse(body, {
    status: backendResponse.status,
    headers: responseHeaders,
  })
}
