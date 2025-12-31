import * as vscode from "vscode";
import { exec } from "child_process";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "claude-implement.implement",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showErrorMessage("No selection");
        return;
      }

      const stub = editor.document.getText(selection);
      const filePath = editor.document.uri.fsPath;
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      const prompt = `In the file ${filePath}, implement this function stub. Return ONLY the completed function code. No markdown fences, no explanation, no comments. Just the raw code.\n\n${stub}`;

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Implementing...",
          cancellable: false,
        },
        async () => {
          try {
            const result = await runClaude(prompt, workspaceRoot);
            await editor.edit((editBuilder) => {
              editBuilder.replace(selection, result);
            });
          } catch (err) {
            vscode.window.showErrorMessage(`Claude error: ${err}`);
          }
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

function runClaude(prompt: string, cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const escaped = prompt
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
    exec(
      `claude -p "${escaped}" --output-format text`,
      { cwd, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(stderr || error.message);
        } else {
          resolve(stdout.trim());
        }
      }
    );
  });
}

export function deactivate() {}
