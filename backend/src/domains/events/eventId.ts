import uuid from "uuid";
const { v5: uuidv5 } = uuid;

const NAMESPACE = uuidv5.URL;

export function stableEventId(key: string): string {
  return uuidv5(String(key), NAMESPACE);
}
