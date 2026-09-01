import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { FileDown, Loader2 } from "lucide-react";

// Worker served locally from /public (copied from pdfjs-dist/build).
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ""}/pdf.worker.min.mjs`;

/**
 * TechSheetPreview
 *  - Renders the first page of the tech-sheet PDF as an inline preview,
 *    giving a premium feel without forcing the visitor to open the file.
 *  - Falls back gracefully to a simple icon on error (e.g. browser blocks
 *    inline PDFs, network issues).
 */
export default function TechSheetPreview({ url, alt = "" }) {
  const [status, setStatus] = useState("loading"); // loading | ready | error

  if (!url) return null;

  return (
    <div
      className="relative w-[160px] sm:w-[190px] shrink-0 rounded-lg overflow-hidden border border-bone-200 bg-white shadow-[0_6px_18px_rgba(45,51,47,0.08)]"
      data-testid="techsheet-preview"
      aria-label={alt}
    >
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-sage-500">
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}
      {status !== "error" ? (
        <Document
          file={url}
          onLoadSuccess={() => setStatus("ready")}
          onLoadError={() => setStatus("error")}
          loading=""
          error=""
          noData=""
        >
          <Page
            pageNumber={1}
            width={190}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            loading=""
            error=""
          />
        </Document>
      ) : (
        <div className="aspect-[210/297] flex items-center justify-center bg-bone-50">
          <FileDown className="text-sage-500" size={30} />
        </div>
      )}
      {/* Subtle sheet-edge highlight */}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5 rounded-lg" />
    </div>
  );
}
