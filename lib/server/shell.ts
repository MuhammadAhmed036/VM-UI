export function sh(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function jsonEnv(config: Record<string, string>) {
  return Buffer.from(JSON.stringify(config), "utf8").toString("base64");
}
