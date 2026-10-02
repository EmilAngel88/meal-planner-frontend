#!/usr/bin/env python3
"""Local-only review server, including HTTP byte ranges for video seeking."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re, shutil
ROOT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**k): super().__init__(*a,directory=str(ROOT),**k)
 def send_head(self):
  self.byte_range=None
  path=Path(self.translate_path(self.path))
  if path.is_dir(): return super().send_head()
  try:f=path.open('rb')
  except OSError:self.send_error(404);return None
  size=path.stat().st_size; start=0; end=size-1
  hdr=self.headers.get('Range')
  if hdr:
   m=re.fullmatch(r'bytes=(\d*)-(\d*)',hdr.strip())
   if not m or not any(m.groups()): f.close();self.send_error(416);return None
   if not m.group(1):start=max(0,size-int(m.group(2)))
   else:
    start=int(m.group(1));end=min(end,int(m.group(2))) if m.group(2) else end
   if start>end or start>=size:
    f.close();self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return None
   self.send_response(206);self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.byte_range=(start,end);f.seek(start)
  else:self.send_response(200)
  self.send_header('Content-type',self.guess_type(str(path)));self.send_header('Accept-Ranges','bytes');self.send_header('Content-Length',str(end-start+1));self.send_header('Cache-Control','no-store');self.end_headers();return f
 def copyfile(self,source,outputfile):
  try:
   if self.byte_range:
    remaining=self.byte_range[1]-self.byte_range[0]+1
    while remaining:
     block=source.read(min(1<<20,remaining))
     if not block:break
     outputfile.write(block);remaining-=len(block)
   else:shutil.copyfileobj(source,outputfile)
  except (BrokenPipeError,ConnectionResetError):pass
 def log_message(self,format,*args):pass
print('Tutorial player: http://127.0.0.1:8767',flush=True)
ThreadingHTTPServer(('127.0.0.1',8767),Handler).serve_forever()
