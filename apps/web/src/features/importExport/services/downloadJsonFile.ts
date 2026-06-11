export function downloadJsonFile(fileName: string, data: unknown) {
  const jsonText = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonText], {
    type: "application/json",
  });

  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(objectUrl);
}
