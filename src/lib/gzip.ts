// Case bases are large; CSV compresses ~10x, so the browser gzips before uploading.
export async function gzipBase64(file: Blob): Promise<string> {
  const stream = file.stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
