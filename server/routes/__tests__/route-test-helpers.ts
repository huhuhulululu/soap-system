import type { Request, Response, Router } from "express";

type HttpMethod = "get" | "post" | "put";
type RouteHandler = (req: Request, res: Response) => unknown;

export function getRouteHandler(
  router: Router,
  method: HttpMethod,
  path: string,
): RouteHandler {
  const layer = (router as unknown as { stack: Array<Record<string, unknown>> }).stack.find(
    (l) =>
      (l as { route?: { path?: string; methods?: Record<string, boolean> } }).route
        ?.path === path &&
      (l as { route?: { methods?: Record<string, boolean> } }).route?.methods?.[
        method
      ],
  ) as
    | {
        route: {
          stack: Array<{ handle: RouteHandler }>;
        };
      }
    | undefined;

  if (!layer || !layer.route || layer.route.stack.length === 0) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

export function createMockResponse(): Response & {
  statusCode: number;
  jsonPayload: unknown;
} {
  const res: {
    statusCode: number;
    jsonPayload: unknown;
    status: (code: number) => unknown;
    json: (payload: unknown) => unknown;
    download: () => unknown;
  } = {
    statusCode: 200,
    jsonPayload: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.jsonPayload = payload;
      return res;
    },
    download() {
      return res;
    },
  };

  return res as unknown as Response & {
    statusCode: number;
    jsonPayload: unknown;
  };
}
