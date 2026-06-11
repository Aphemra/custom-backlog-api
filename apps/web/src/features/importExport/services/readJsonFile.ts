export async function readJsonFile(file: File): Promise<unknown> {
  const fileText = await file.text();

  try {
    return JSON.parse(fileText);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
}
