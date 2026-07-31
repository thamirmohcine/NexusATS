import { PDFParse } from "pdf-parse";

import { createLogger } from "./logger.js";

const logger = createLogger({
  level: (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") ??
    "info",
}).child({ module: "PDFService" });

export const extractPdfText = async (pdfBuffer: Buffer): Promise<string> => {
  const startTime = Date.now();
  const fileSize = pdfBuffer.length;

  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const result = await parser.getText();
    const textLength = result.text.trim().length;

    logger.info("PDF text extracted", {
      duration: Date.now() - startTime,
      fileSize,
      textLength,
      hasContent: textLength > 0,
    });

    return result.text.trim();
  } catch (error) {
    logger.warn("PDF parsing failed", {
      duration: Date.now() - startTime,
      fileSize,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  } finally {
    await parser.destroy();
  }
};
