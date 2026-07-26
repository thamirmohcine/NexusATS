import { PDFParse } from "pdf-parse";

export const extractPdfText = async (pdfBuffer: Buffer): Promise<string> => {
  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
};
