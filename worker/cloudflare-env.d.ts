/// <reference types="@cloudflare/workers-types" />

// Declaration-merges the actual Worker bindings into Cloudflare's ambient `Cloudflare.Env`
// namespace (the same mechanism `wrangler types` generates into) so worker/index.ts and
// db/index.ts's `import { env } from "cloudflare:workers"` share one binding shape instead of
// two hand-rolled copies that could drift apart. Referencing @cloudflare/workers-types here is
// safe project-wide despite the app also using the `dom` lib (React components) because
// tsconfig.json has `skipLibCheck: true`, which suppresses the duplicate-global conflicts
// (Response, Request, ReadableStream, etc.) that the two ambient sources would otherwise raise.
declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    IMAGES: {
      input(stream: ReadableStream): {
        transform(options: Record<string, unknown>): {
          output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
        };
      };
    };
  }
}
