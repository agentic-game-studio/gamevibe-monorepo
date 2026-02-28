import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'showcase-portal',
    version: process.env.npm_package_version || '0.1.0',
  });
}