// Minimal, dependency-free, DETERMINISTIC tar + gzip writer for the OKF bundle download
// (okf.tar.gz). POSIX ustar headers with fixed mtime/uid/gid and entries sorted by name, so the
// archive bytes change only when file CONTENT changes — no churn from build timestamps or readdir
// order. Avoids the BSD-vs-GNU `tar` flag differences and macOS AppleDouble (._*) noise.

import zlib from 'node:zlib';

// Octal field: (len - 1) zero-padded digits + a trailing NUL.
function octalField(n, len) {
  return n.toString(8).padStart(len - 1, '0') + '\0';
}

function tarHeader(name, size) {
  if (Buffer.byteLength(name, 'utf8') > 100) throw new Error(`tar name too long for ustar: ${name}`);
  const h = Buffer.alloc(512, 0);
  h.write(name, 0, 'utf8');                 // name[100]
  h.write('0000644\0', 100, 'ascii');       // mode[8]  -> 0644
  h.write('0000000\0', 108, 'ascii');       // uid[8]
  h.write('0000000\0', 116, 'ascii');       // gid[8]
  h.write(octalField(size, 12), 124, 'ascii'); // size[12]
  h.write(octalField(0, 12), 136, 'ascii');    // mtime[12] -> 0 (deterministic)
  h.write('        ', 148, 'ascii');         // chksum[8] placeholder = 8 spaces
  h.write('0', 156, 'ascii');                // typeflag '0' = regular file
  h.write('ustar\0', 257, 'ascii');          // magic[6]
  h.write('00', 263, 'ascii');               // version[2]
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += h[i];
  // checksum field: 6 octal digits + NUL + space
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  return h;
}

// files: Array<{ name: string, content: string|Buffer }>. Returns a gzipped tar Buffer.
export function makeTarGz(files) {
  const sorted = [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const blocks = [];
  for (const f of sorted) {
    const content = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content, 'utf8');
    blocks.push(tarHeader(f.name, content.length), content);
    const pad = (512 - (content.length % 512)) % 512;
    if (pad) blocks.push(Buffer.alloc(pad, 0));
  }
  blocks.push(Buffer.alloc(1024, 0)); // two zero blocks terminate the archive
  // Node's gzip header carries no mtime/filename, so this is deterministic for identical input.
  return zlib.gzipSync(Buffer.concat(blocks), { level: 9 });
}
