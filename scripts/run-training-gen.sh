#!/bin/bash
# Launch 6 parallel training data generators in tmux
# Usage: ./scripts/run-training-gen.sh [count]
#   default count = 10000

COUNT=${1:-10000}
DIR="$(cd "$(dirname "$0")/.." && pwd)"

tmux kill-session -t training 2>/dev/null

tmux new-session -d -s training -n gen -c "$DIR" \
  "npx tsx scripts/generate-training-data.ts --bp=SHOULDER --count=$COUNT; echo '=== SHOULDER DONE ==='; read"

tmux split-window -t training -h -c "$DIR" \
  "npx tsx scripts/generate-training-data.ts --bp=KNEE --count=$COUNT; echo '=== KNEE DONE ==='; read"

tmux split-window -t training -v -c "$DIR" \
  "npx tsx scripts/generate-training-data.ts --bp=LBP --count=$COUNT; echo '=== LBP DONE ==='; read"

tmux select-pane -t 0
tmux split-window -t training -v -c "$DIR" \
  "npx tsx scripts/generate-training-data.ts --bp=NECK --count=$COUNT; echo '=== NECK DONE ==='; read"

tmux select-pane -t 2
tmux split-window -t training -v -c "$DIR" \
  "npx tsx scripts/generate-training-data.ts --bp=ELBOW --count=$COUNT; echo '=== ELBOW DONE ==='; read"

tmux select-pane -t 4
tmux split-window -t training -v -c "$DIR" \
  "npx tsx scripts/generate-training-data.ts --bp=HIP --count=$COUNT; echo '=== HIP DONE ==='; read"

tmux select-layout -t training tiled
echo "Training data generation started in tmux session 'training'"
echo "Run: tmux attach -t training"
echo "Count per body part: $COUNT"
tmux attach -t training
