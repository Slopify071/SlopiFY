/**
 * SlopiFY Cloudflare Worker API
 * 
 * Serverless API proxy for Cloudflare R2 audio file storage:
 * - OPTIONS * : Preflight CORS handler
 * - POST /api/upload : Authenticated file upload to Cloudflare R2
 * - GET /api/audio/:r2Key : HTTP Range streaming for smooth audio seeking (206 Partial Content)
 * - DELETE /api/audio/:r2Key : Delete file from R2
 * - GET /api/storage-info : Storage byte usage statistics
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range, X-File-Name, X-Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

// Simple Base64 URL Decode helper for verifying JWT payload without heavy dependencies
function parseJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    return null;
  }
}

function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const payload = parseJwtPayload(token);

  if (!payload) return null;

  // Check expiration timestamp
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return null;
  }

  return payload;
}

function sanitizeFilename(filename) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // 2. GET /api/storage-info — Storage usage summary
      if (pathname === '/api/storage-info' && request.method === 'GET') {
        if (!env.SLOPIFY_AUDIO_BUCKET) {
          return jsonResponse({
            success: true,
            totalBytes: 0,
            totalFiles: 0,
            limitBytes: 10737418240, // 10 GB
            mocked: true,
          });
        }

        let totalBytes = 0;
        let totalFiles = 0;
        let cursor = undefined;

        do {
          const list = await env.SLOPIFY_AUDIO_BUCKET.list({ cursor });
          for (const object of list.objects) {
            totalBytes += object.size;
            totalFiles += 1;
          }
          cursor = list.truncated ? list.cursor : undefined;
        } while (cursor);

        return jsonResponse({
          success: true,
          totalBytes,
          totalFiles,
          limitBytes: 10737418240, // 10 GB
        });
      }

      // 3. POST /api/upload — Stream audio to R2 bucket
      if (pathname === '/api/upload' && request.method === 'POST') {
        const user = verifyAuth(request, env);
        if (!user) {
          return errorResponse('Unauthorized: Invalid or missing authentication token', 401);
        }

        if (!env.SLOPIFY_AUDIO_BUCKET) {
          return errorResponse('R2 Bucket binding SLOPIFY_AUDIO_BUCKET not found in environment', 500);
        }

        const contentTypeHeader = request.headers.get('Content-Type') || '';
        let fileData;
        let originalName = 'audio.mp3';
        let contentType = 'audio/mpeg';

        if (contentTypeHeader.includes('multipart/form-data')) {
          const formData = await request.formData();
          const file = formData.get('file');
          if (!file || typeof file === 'string') {
            return errorResponse('No file uploaded in form data');
          }
          fileData = await file.arrayBuffer();
          originalName = file.name || originalName;
          contentType = file.type || contentType;
        } else {
          // Direct binary upload with metadata headers
          fileData = await request.arrayBuffer();
          originalName = request.headers.get('X-File-Name') || originalName;
          contentType = request.headers.get('X-Content-Type') || contentTypeHeader || contentType;
        }

        if (!fileData || fileData.byteLength === 0) {
          return errorResponse('File body is empty');
        }

        const cleanName = sanitizeFilename(originalName);
        const r2Key = `songs/${Date.now()}_${cleanName}`;

        await env.SLOPIFY_AUDIO_BUCKET.put(r2Key, fileData, {
          httpMetadata: {
            contentType,
            cacheControl: 'public, max-age=31536000',
          },
          customMetadata: {
            uploaderUid: user.sub || user.user_id || 'unknown',
            originalName,
            uploadedAt: new Date().toISOString(),
          },
        });

        const baseUrl = `${url.protocol}//${url.host}`;
        return jsonResponse({
          success: true,
          r2Key,
          size: fileData.byteLength,
          contentType,
          audioUrl: `${baseUrl}/api/audio/${r2Key}`,
        }, 201);
      }

      // 4. GET /api/audio/* — Stream audio file with HTTP Range support for scrubbing
      if (pathname.startsWith('/api/audio/') && request.method === 'GET') {
        const r2Key = decodeURIComponent(pathname.replace('/api/audio/', ''));
        if (!r2Key) {
          return errorResponse('Audio key parameter missing', 400);
        }

        if (!env.SLOPIFY_AUDIO_BUCKET) {
          return errorResponse('R2 Bucket binding SLOPIFY_AUDIO_BUCKET not found in environment', 500);
        }

        const rangeHeader = request.headers.get('Range');
        
        let object;
        if (rangeHeader) {
          object = await env.SLOPIFY_AUDIO_BUCKET.get(r2Key, {
            range: request.headers,
          });
        } else {
          object = await env.SLOPIFY_AUDIO_BUCKET.get(r2Key);
        }

        if (!object) {
          return errorResponse('Audio file not found', 404);
        }

        const headers = new Headers(CORS_HEADERS);
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Accept-Ranges', 'bytes');

        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'audio/mpeg');
        }

        // Return 206 Partial Content for range request, else 200 OK
        const status = object.range ? 206 : 200;
        return new Response(object.body, {
          status,
          headers,
        });
      }

      // 5. DELETE /api/audio/* — Delete audio object from R2
      if (pathname.startsWith('/api/audio/') && request.method === 'DELETE') {
        const user = verifyAuth(request, env);
        if (!user) {
          return errorResponse('Unauthorized: Invalid or missing authentication token', 401);
        }

        const r2Key = decodeURIComponent(pathname.replace('/api/audio/', ''));
        if (!r2Key) {
          return errorResponse('Audio key parameter missing', 400);
        }

        if (!env.SLOPIFY_AUDIO_BUCKET) {
          return errorResponse('R2 Bucket binding SLOPIFY_AUDIO_BUCKET not found in environment', 500);
        }

        await env.SLOPIFY_AUDIO_BUCKET.delete(r2Key);

        return jsonResponse({
          success: true,
          r2Key,
          deletedAt: new Date().toISOString(),
        });
      }

      return errorResponse(`Route ${request.method} ${pathname} not found`, 404);
    } catch (err) {
      console.error('Worker internal error:', err);
      return errorResponse(`Server Error: ${err.message}`, 500);
    }
  },
};
