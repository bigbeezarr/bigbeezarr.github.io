// Exemple officiel de la documentation AWS SigV4 (IAM ListUsers, 2015-08-30).
import { signV4 } from "../src/aws.js";
const h = await signV4({
  method: "GET", url: "https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08",
  headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
  accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  region: "us-east-1", service: "iam", amzDate: "20150830T123600Z",
});
const want = "5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7";
const got = h.authorization.split("Signature=")[1];
console.log(got === want ? "SigV4 OK" : "SigV4 MISMATCH " + got);
if (got !== want) process.exit(1);
