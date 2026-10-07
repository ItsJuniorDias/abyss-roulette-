import english from '../../assets/locales/en.json';
export type MessageKey = keyof typeof english;
export function t(key: MessageKey, values: Record<string, string | number> = {}): string {
  return english[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values[name] ?? `{${name}}`),
  );
}
