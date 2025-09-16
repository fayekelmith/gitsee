export function parse_files_contents(content: string): Map<string, string> {
  const files = new Map<string, string>();
  const lines = content.split("\n");

  let inCode = false;
  let currentFileName: string | null = null;
  let currentFileContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        // Exit code - save the file
        if (currentFileName) {
          files.set(currentFileName, currentFileContent.join("\n"));
          currentFileName = null;
          currentFileContent = [];
        }
        inCode = false;
      } else {
        // Enter code
        inCode = true;
      }
    } else if (inCode) {
      // We're in code, collect content
      currentFileContent.push(line);
    } else {
      // We're out of code
      if (line.trim()) {
        // Overwrite the filename with this line - it's the latest candidate
        currentFileName = line.trim();
      }
    }
  }

  return files;
}
