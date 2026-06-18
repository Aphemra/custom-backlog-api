export function confirmDestructiveAction({ title, detail, confirmationText }: { title: string; detail: string; confirmationText: string }): boolean {
  const userInput = window.prompt(`${title}\n\n${detail}\n\nType ${confirmationText} to confirm.`);

  return userInput === confirmationText;
}
