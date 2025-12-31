import * as vscode from "vscode";

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

      const prompt = `In the file ${filePath}, implement this function stub. Return ONLY the completed function code. No markdown fences, no explanation, no comments about what you did. Just the raw code.\n\n${stub}`;

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Implementing",
          cancellable: true,
        },
        async (progress, token) => {
          let seconds = 0;
          const timer = setInterval(() => {
            seconds++;
            progress.report({ message: `${seconds}s elapsed...` });
          }, 1000);

          token.onCancellationRequested(() => {
            clearInterval(timer);
          });

          try {
            const result = await runClaude(prompt, workspaceRoot);
            clearInterval(timer);
            await editor.edit((editBuilder) => {
              editBuilder.replace(selection, result);
            });
          } catch (err) {
            clearInterval(timer);
            vscode.window.showErrorMessage(`Claude error: ${err}`);
          }
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

import { spawn } from "child_process";

function runClaude(prompt: string, cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["-p", "-", "--output-format", "text"], {
      cwd,
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data;
    });
    proc.stderr.on("data", (data) => {
      stderr += data;
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(stderr || `Process exited with code ${code}`);
      }
    });

    proc.on("error", (err) => {
      reject(err.message);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

export function deactivate() {}
