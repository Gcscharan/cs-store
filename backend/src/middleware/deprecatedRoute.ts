import type { Request, Response, NextFunction } from "express";

export function deprecatedRoute(args: {
  label: string;
  replacement?: string;
  block?: boolean;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const userEmail = String((req as any)?.user?.email || "anonymous");
      const msg = `[DEPRECATED_ROUTE] label=${args.label} user=${userEmail} method=${req.method} url=${req.originalUrl}`;
      console.warn(msg);
      res.setHeader("x-deprecated-route", args.label);
      if (args.replacement) {
        res.setHeader("x-deprecated-replacement", args.replacement);
      }

      if (args.block) {
        res.status(410).json({ error: "DEPRECATED_ROUTE" });
        return;
      }
    } catch {
    }

    next();
  };
}
