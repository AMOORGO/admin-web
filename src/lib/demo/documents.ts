/** Placeholder KYC documents returned by the demo's "signed URL" endpoint: self-contained data: URIs (SVG image / one-page PDF). */
import { labelFor } from "./logic/captain";

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface PlaceholderInput {
  type: string;
  holder: string;
  number: string | null;
  expiry: string | null;
  captainRef: string;
}

const ACCENT: Record<string, string> = {
  DRIVERS_LICENSE: "#1D4F91",
  GOVERNMENT_ID: "#14755F",
  VEHICLE_REGISTRATION: "#7A2B66",
  VEHICLE_INSURANCE: "#B02414",
  BACKGROUND_CHECK: "#3A102F",
  PROFILE_PHOTO: "#521A44",
  DRIVING_RECORD: "#1D4F91",
  DEACTIVATION_EXPLANATION: "#6B5B66",
};

/** SVG "photo" of a document with obviously fake details and a diagonal SAMPLE watermark. */
export function placeholderSvg(input: PlaceholderInput): string {
  const accent = ACCENT[input.type] ?? "#3A102F";
  const title = labelFor(input.type);
  const isPhoto = input.type === "PROFILE_PHOTO";
  const rows: Array<[string, string]> = [
    ["HOLDER", input.holder.toUpperCase()],
    ["NUMBER", input.number ?? "N/A"],
    ["EXPIRES", input.expiry ?? "N/A"],
    ["REF", input.captainRef.slice(0, 8).toUpperCase()],
  ];
  const body = isPhoto
    ? `<rect x="300" y="110" width="200" height="260" rx="14" fill="#E9D8E3"/><circle cx="400" cy="205" r="52" fill="#B497AA"/><path d="M300 370 C300 290 500 290 500 370 Z" fill="#B497AA"/>
       <text x="400" y="410" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#3A102F">${esc(input.holder)}</text>`
    : `<rect x="48" y="118" width="170" height="210" rx="10" fill="#E9D8E3"/><circle cx="133" cy="190" r="38" fill="#B497AA"/><path d="M60 328 C60 262 206 262 206 328 Z" fill="#B497AA"/>
       ${rows
         .map(
           ([k, v], i) =>
             `<text x="250" y="${150 + i * 54}" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#7A6B75" letter-spacing="1.5">${k}</text>
              <text x="250" y="${174 + i * 54}" font-family="'Courier New', monospace" font-size="24" font-weight="700" fill="#1C121A">${esc(v)}</text>`,
         )
         .join("")}
       <rect x="48" y="350" width="704" height="2" fill="#E5D3DE"/>
       <text x="48" y="384" font-family="Arial, sans-serif" font-size="13" fill="#7A6B75">State of Texas | Class C | Restrictions: none | Endorsements: none</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
    <rect width="800" height="520" fill="#FFFFFF"/>
    <rect width="800" height="84" fill="${accent}"/>
    <text x="48" y="52" font-family="Arial, sans-serif" font-size="28" font-weight="800" fill="#FFFFFF">${esc(title)}</text>
    <text x="752" y="52" text-anchor="end" font-family="Arial, sans-serif" font-size="14" fill="#FFFFFF" opacity="0.85">AMOORGO DEMO</text>
    ${body}
    <g transform="rotate(-24 400 290)" opacity="0.16">
      <text x="400" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="74" font-weight="900" fill="${accent}">SAMPLE</text>
      <text x="400" y="352" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${accent}">DEMO DATA - NOT A REAL DOCUMENT</text>
    </g>
    <rect x="1" y="1" width="798" height="518" fill="none" stroke="#E5D3DE" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const pdfText = (s: string): string => s.replace(/[^\x20-\x7e]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** A valid one-page PDF built by hand (no library): Helvetica text only. */
export function placeholderPdf(input: PlaceholderInput): string {
  const title = labelFor(input.type);
  const lines: Array<{ size: number; text: string }> = [
    { size: 22, text: title },
    { size: 11, text: "AMOORGO demo - sample document, not a real record" },
    { size: 13, text: "" },
    { size: 14, text: `Holder: ${input.holder}` },
    { size: 14, text: `Number: ${input.number ?? "N/A"}` },
    { size: 14, text: `Valid until: ${input.expiry ?? "N/A"}` },
    { size: 14, text: `Reference: ${input.captainRef.slice(0, 8).toUpperCase()}` },
    { size: 12, text: "" },
    { size: 12, text: "Result: CLEAR. No disqualifying records found in the checked period." },
    { size: 12, text: "This page was generated locally in your browser for the demo." },
  ];
  let stream = "BT\n72 740 Td\n";
  for (const l of lines) stream += `/F1 ${l.size} Tf\n(${pdfText(l.text)}) Tj\n0 -${l.size + 14} Td\n`;
  stream += "ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${btoa(pdf)}`;
}
