#!/bin/bash

# Fix all github.copilot command registrations in TypeScript files
find src/extension -name "*.ts" -type f -exec sed -i '' \
  -e 's/registerCommand(\s*["'\'']\(github\.copilot\.[^"'\'']*\)["'\'']/registerCommand("acp.\1"/g' \
  -e 's/executeCommand(\s*["'\'']\(github\.copilot\.[^"'\'']*\)["'\'']/executeCommand("acp.\1"/g' \
  -e 's/getCommands(\s*["'\'']\(github\.copilot\.[^"'\'']*\)["'\'']/getCommands("acp.\1"/g' \
  {} +

echo "Command ID fixes complete"
