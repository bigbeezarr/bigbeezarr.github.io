"""Brotli minimal pour fontTools (compression WOFF2), via le zlib intégré de Node.js. Outil de build uniquement."""
import subprocess
MODE_GENERIC, MODE_TEXT, MODE_FONT = 0, 1, 2
_JS = ("const z=require('zlib');const c=[];process.stdin.on('data',d=>c.push(d)).on('end',()=>{const b=Buffer.concat(c);"
       "const m=process.argv[1];const o=m==='d'?z.brotliDecompressSync(b):z.brotliCompressSync(b,{params:{[z.constants.BROTLI_PARAM_MODE]:+process.argv[2],[z.constants.BROTLI_PARAM_QUALITY]:+process.argv[3],[z.constants.BROTLI_PARAM_SIZE_HINT]:b.length}});process.stdout.write(o)})")
def compress(data, mode=MODE_GENERIC, quality=11, lgwin=22, lgblock=0):
    return subprocess.run(['node', '-e', _JS, 'c', str(mode), str(quality)], input=bytes(data), capture_output=True, check=True).stdout
def decompress(data):
    return subprocess.run(['node', '-e', _JS, 'd', '0', '0'], input=bytes(data), capture_output=True, check=True).stdout
class error(Exception): pass
