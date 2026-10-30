"""Imitation locale d'Amazon Rekognition pour les tests (aucune vraie reconnaissance).
Chaque image compte pour un « visage » dont la signature est un dHash ; la similarité baisse avec la distance.
Usage : python3 test/mock_rekognition.py 9911
"""
import base64, io, json, sys, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image

collections = {}
calls = []

class BadImage(Exception): pass

def dhash(b):
    try: im = Image.open(io.BytesIO(b)).convert("L").resize((9, 8))
    except Exception: raise BadImage()
    px = list(im.getdata()); v = 0
    for r in range(8):
        for c in range(8):
            v = (v << 1) | (px[r * 9 + c] > px[r * 9 + c + 1])
    return v

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def reply(self, code, obj, typ=None):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/x-amz-json-1.1")
        if typ: self.send_header("x-amzn-ErrorType", typ)
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        self.reply(200, {"calls": calls, "collections": {k: len(v) for k, v in collections.items()}})
    def do_POST(self):
        auth = self.headers.get("Authorization", "")
        target = self.headers.get("X-Amz-Target", "").split(".")[-1]
        data = json.loads(self.rfile.read(int(self.headers["Content-Length"])) or b"{}")
        calls.append({"target": target, "signed": auth.startswith("AWS4-HMAC-SHA256 Credential=") and "/ca-central-1/rekognition/aws4_request" in auth and "Signature=" in auth})
        if not calls[-1]["signed"]:
            return self.reply(403, {"__type": "UnrecognizedClientException", "message": "bad signature"}, "UnrecognizedClientException")
        try: return self.handle_target(target, data)
        except BadImage: return self.reply(400, {"__type": "InvalidImageFormatException", "message": "Request has invalid image format"}, "InvalidImageFormatException")
    def handle_target(self, target, data):
        cid = data.get("CollectionId")
        if target == "CreateCollection":
            if cid in collections: return self.reply(400, {"__type": "ResourceAlreadyExistsException"}, "ResourceAlreadyExistsException")
            collections[cid] = []; return self.reply(200, {"StatusCode": 200})
        if target == "DeleteCollection":
            if cid not in collections: return self.reply(400, {"__type": "ResourceNotFoundException"}, "ResourceNotFoundException")
            del collections[cid]; return self.reply(200, {"StatusCode": 200})
        if cid not in collections: return self.reply(400, {"__type": "ResourceNotFoundException"}, "ResourceNotFoundException")
        if target == "IndexFaces":
            h = dhash(base64.b64decode(data["Image"]["Bytes"]))
            fid = str(uuid.uuid4()); collections[cid].append({"FaceId": fid, "ExternalImageId": data["ExternalImageId"], "h": h})
            return self.reply(200, {"FaceRecords": [{"Face": {"FaceId": fid, "ExternalImageId": data["ExternalImageId"]}}]})
        if target == "SearchFacesByImage":
            raw = base64.b64decode(data["Image"]["Bytes"])
            if len(raw) < 2000: return self.reply(400, {"__type": "InvalidParameterException", "message": "There are no faces in the image."}, "InvalidParameterException")
            h = dhash(raw); out = []
            for f in collections[cid]:
                sim = max(0.0, 100.0 - 2.5 * bin(f["h"] ^ h).count("1"))
                if sim >= data.get("FaceMatchThreshold", 80): out.append({"Similarity": sim, "Face": {"FaceId": f["FaceId"], "ExternalImageId": f["ExternalImageId"]}})
            return self.reply(200, {"FaceMatches": out})
        if target == "DeleteFaces":
            ids = set(data["FaceIds"]); collections[cid] = [f for f in collections[cid] if f["FaceId"] not in ids]
            return self.reply(200, {"DeletedFaces": list(ids)})
        return self.reply(400, {"__type": "UnknownOperationException"}, "UnknownOperationException")

ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1] if len(sys.argv) > 1 else 9911)), H).serve_forever()
