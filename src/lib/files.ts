export type ShareFileOutcome = "shared" | "downloaded" | "cancelled";

export async function shareOrDownloadJson(
  content: string,
  filename: string,
): Promise<ShareFileOutcome> {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const file = new File([blob], filename, { type: "application/json" });

  if (
    typeof navigator.share === "function" &&
    (typeof navigator.canShare !== "function" ||
      navigator.canShare({ files: [file] }))
  ) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "downloaded";
}

export function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("File could not be read"));
    reader.readAsText(file);
  });
}
