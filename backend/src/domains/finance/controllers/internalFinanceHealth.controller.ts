import type { Request, Response } from "express";

import { getFinanceHealth } from "../services/financeHealthService";

export async function getFinanceHealthHandler(_req: Request, res: Response) {
  const out = await getFinanceHealth();
  return res.status(200).json(out);
}
