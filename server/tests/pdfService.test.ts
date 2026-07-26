import assert from "node:assert/strict";
import test from "node:test";

import { extractPdfText } from "../src/services/pdf.js";

const createResumePdfBuffer = (): Buffer =>
  Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 70 >>
stream
BT /F1 24 Tf 72 720 Td (Maya Chen TypeScript Node.js Resume) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
431
%%EOF`);

test("extractPdfText returns plain text from a PDF buffer", async () => {
  const text = await extractPdfText(createResumePdfBuffer());

  assert.match(text, /Maya Chen/);
  assert.match(text, /TypeScript/);
  assert.match(text, /Node\.js/);
});
