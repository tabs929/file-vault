'use client'

import dynamic from 'next/dynamic'

export default dynamic(() => import('./dot-field'), { ssr: false })
