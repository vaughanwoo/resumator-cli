import JSZip from "jszip";

/**
 * Zip the deliverables for one resume. The HTML is already self-contained,
 * so the recipient can unzip and double-click index.html with no server.
 */
export async function renderZip({ html, pdf, docx, baseName, name }) {
  const zip = new JSZip();
  const folder = zip.folder(baseName);
  folder.file("index.html", html);
  if (pdf) folder.file(`${baseName}.pdf`, pdf);
  if (docx) folder.file(`${baseName}.docx`, docx);
  folder.file(
    "README.txt",
    [
      `${name ?? "Resume"}`,
      "",
      "index.html  Open in any web browser (double-click). Works offline.",
      pdf ? `${baseName}.pdf  Print-ready PDF.` : null,
      docx ? `${baseName}.docx  Editable Word document.` : null,
      "",
    ].filter((l) => l !== null).join("\n"),
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
