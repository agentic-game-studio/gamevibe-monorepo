import { IncomingMessage, ServerResponse } from 'http';

/**
 * Send a JSON response
 */
export function sendJSON(res: ServerResponse, data: any, statusCode = 200): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

/**
 * Send an error response
 */
export function sendError(res: ServerResponse, statusCode: number, message: string): void {
  sendJSON(res, { error: message }, statusCode);
}

/**
 * Parse JSON request body
 */
export async function parseRequest<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    req.on('error', reject);
  });
}