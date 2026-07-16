import { evaluateCommand, listPacks } from "./index.js";

const packs = listPacks();
console.log(`Loaded ${packs.length} packs.`);

const samples = [
  "git reset --hard origin/main",
  "git checkout -b feature/new-thing",
  "rm -rf node_modules",
  "rm -rf /",
  "kubectl delete namespace production",
  "docker system prune -af",
  "npm install lodash",
  "aws s3 rb s3://my-bucket --force",
  "terraform apply",
  "terraform destroy -auto-approve",
];

for (const cmd of samples) {
  const result = evaluateCommand(cmd);
  const status = result.allowed ? "ALLOW" : `BLOCK (${result.severity})`;
  console.log(`\n$ ${cmd}\n  -> ${status}`);
  for (const m of result.matches.slice(0, 3)) {
    console.log(`     [${m.severity}] ${m.packId} / ${m.patternName ?? "unnamed"}: ${m.reason}`);
  }
}
