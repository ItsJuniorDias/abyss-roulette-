export function secureIndex(max = 37) {
  if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000)
    throw new RangeError('Invalid range');
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}
