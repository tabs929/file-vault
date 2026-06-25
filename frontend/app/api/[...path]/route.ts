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
  try {
    const path = params.path.join('/')
    const url = new URL(request.url)
    const backendUrl = `${BACKEND_URL}/${path}${url.search}`

    const headers = new Headers()

    const contentType = request.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)

    const cookie = request.headers.get('cookie')
    if (cookie) headers.set('cookie', cookie)

    headers.set('origin', request.headers.get('origin') || '')

    // Forward real client IP for rate limiting
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip')
    if (realIp) {
      headers.set('x-forwarded-for', realIp)
      headers.set('x-real-ip', realIp)
    }

    const init: RequestInit = {
      method: request.method,
      headers,
    }

    // Only read body for methods that have one.
    // DELETE, GET, HEAD typically have no body — calling request.text()
    // on a bodyless request throws in Vercel's edge runtime.
    const methodsWithBody = ['POST', 'PUT', 'PATCH']
    if (methodsWithBody.includes(request.method)) {
      const body = await request.text()
      if (body) init.body = body
    }

    const backendResponse = await fetch(backendUrl, init)

    const responseHeaders = new Headers()
    const responseContentType = backendResponse.headers.get('content-type')
    if (responseContentType) {
      responseHeaders.set('content-type', responseContentType)
    }

    const setCookie = backendResponse.headers.get('set-cookie')
    if (setCookie) {
      // Strip domain flag so the cookie is stored on the Vercel domain
      const cleanedCookie = setCookie.replace(/; domain=[^;]*/gi, '')
      responseHeaders.set('set-cookie', cleanedCookie)
    }

    // 204 No Content (e.g. delete success) has no body — response.text() would fail
    if (backendResponse.status === 204) {
      return new NextResponse(null, {
        status: 204,
        headers: responseHeaders,
      })
    }

    const body = await backendResponse.text()
    return new NextResponse(body, {
      status: backendResponse.status,
      headers: responseHeaders,
    })

  } catch (error) {
    console.error('Proxy error:', error)
    return new NextResponse(
      JSON.stringify({ detail: 'Proxy error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}
