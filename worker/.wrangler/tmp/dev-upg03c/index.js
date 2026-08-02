var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-N7LAWL/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Range, X-File-Name, X-Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS
    }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}
__name(errorResponse, "errorResponse");
function parseJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url)
      return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    return null;
  }
}
__name(parseJwtPayload, "parseJwtPayload");
function verifyAuth(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  const payload = parseJwtPayload(token);
  if (!payload)
    return null;
  if (payload.exp && payload.exp * 1e3 < Date.now()) {
    return null;
  }
  return payload;
}
__name(verifyAuth, "verifyAuth");
function sanitizeFilename(filename) {
  return filename.toLowerCase().replace(/[^a-z0-9._-]/g, "_").replace(/_+/g, "_");
}
__name(sanitizeFilename, "sanitizeFilename");
var src_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }
    const url = new URL(request.url);
    const pathname = url.pathname;
    try {
      if (pathname === "/api/storage-info" && request.method === "GET") {
        if (!env.SLOPIFY_AUDIO_BUCKET) {
          return jsonResponse({
            success: true,
            totalBytes: 0,
            totalFiles: 0,
            limitBytes: 10737418240,
            // 10 GB
            mocked: true
          });
        }
        let totalBytes = 0;
        let totalFiles = 0;
        let cursor = void 0;
        do {
          const list = await env.SLOPIFY_AUDIO_BUCKET.list({ cursor });
          for (const object of list.objects) {
            totalBytes += object.size;
            totalFiles += 1;
          }
          cursor = list.truncated ? list.cursor : void 0;
        } while (cursor);
        return jsonResponse({
          success: true,
          totalBytes,
          totalFiles,
          limitBytes: 10737418240
          // 10 GB
        });
      }
      if (pathname === "/api/upload" && request.method === "POST") {
        const user = verifyAuth(request, env);
        if (!user) {
          return errorResponse("Unauthorized: Invalid or missing authentication token", 401);
        }
        if (!env.SLOPIFY_AUDIO_BUCKET) {
          return errorResponse("R2 Bucket binding SLOPIFY_AUDIO_BUCKET not found in environment", 500);
        }
        const contentTypeHeader = request.headers.get("Content-Type") || "";
        let fileData;
        let originalName = "audio.mp3";
        let contentType = "audio/mpeg";
        if (contentTypeHeader.includes("multipart/form-data")) {
          const formData = await request.formData();
          const file = formData.get("file");
          if (!file || typeof file === "string") {
            return errorResponse("No file uploaded in form data");
          }
          fileData = await file.arrayBuffer();
          originalName = file.name || originalName;
          contentType = file.type || contentType;
        } else {
          fileData = await request.arrayBuffer();
          originalName = request.headers.get("X-File-Name") || originalName;
          contentType = request.headers.get("X-Content-Type") || contentTypeHeader || contentType;
        }
        if (!fileData || fileData.byteLength === 0) {
          return errorResponse("File body is empty");
        }
        const cleanName = sanitizeFilename(originalName);
        const r2Key = `songs/${Date.now()}_${cleanName}`;
        await env.SLOPIFY_AUDIO_BUCKET.put(r2Key, fileData, {
          httpMetadata: {
            contentType,
            cacheControl: "public, max-age=31536000"
          },
          customMetadata: {
            uploaderUid: user.sub || user.user_id || "unknown",
            originalName,
            uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
        const baseUrl = `${url.protocol}//${url.host}`;
        return jsonResponse({
          success: true,
          r2Key,
          size: fileData.byteLength,
          contentType,
          audioUrl: `${baseUrl}/api/audio/${r2Key}`
        }, 201);
      }
      if (pathname.startsWith("/api/audio/") && request.method === "GET") {
        const r2Key = decodeURIComponent(pathname.replace("/api/audio/", ""));
        if (!r2Key) {
          return errorResponse("Audio key parameter missing", 400);
        }
        if (!env.SLOPIFY_AUDIO_BUCKET) {
          return errorResponse("R2 Bucket binding SLOPIFY_AUDIO_BUCKET not found in environment", 500);
        }
        const rangeHeader = request.headers.get("Range");
        let object;
        if (rangeHeader) {
          object = await env.SLOPIFY_AUDIO_BUCKET.get(r2Key, {
            range: request.headers
          });
        } else {
          object = await env.SLOPIFY_AUDIO_BUCKET.get(r2Key);
        }
        if (!object) {
          return errorResponse("Audio file not found", 404);
        }
        const headers = new Headers(CORS_HEADERS);
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("Accept-Ranges", "bytes");
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "audio/mpeg");
        }
        const status = object.range ? 206 : 200;
        return new Response(object.body, {
          status,
          headers
        });
      }
      if (pathname.startsWith("/api/audio/") && request.method === "DELETE") {
        const user = verifyAuth(request, env);
        if (!user) {
          return errorResponse("Unauthorized: Invalid or missing authentication token", 401);
        }
        const r2Key = decodeURIComponent(pathname.replace("/api/audio/", ""));
        if (!r2Key) {
          return errorResponse("Audio key parameter missing", 400);
        }
        if (!env.SLOPIFY_AUDIO_BUCKET) {
          return errorResponse("R2 Bucket binding SLOPIFY_AUDIO_BUCKET not found in environment", 500);
        }
        await env.SLOPIFY_AUDIO_BUCKET.delete(r2Key);
        return jsonResponse({
          success: true,
          r2Key,
          deletedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      return errorResponse(`Route ${request.method} ${pathname} not found`, 404);
    } catch (err) {
      console.error("Worker internal error:", err);
      return errorResponse(`Server Error: ${err.message}`, 500);
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-N7LAWL/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-N7LAWL/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
