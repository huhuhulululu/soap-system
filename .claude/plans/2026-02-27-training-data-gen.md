# Training Data Generation — Phase A (SOAP)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate 60,000 SOAP training samples (5 body parts × 10,000 IE+TX + HIP × 10,000 IE-only), output as JSONL + chat format.

**Architecture:** Single script accepts --bp and --count args. Uses PRNG seeded per sample to randomize patient context from weighted distributions. Outputs to training-data/raw/ (JSONL) and training-data/chat/ (conversation format). Shell script launches 6 tmux panes in parallel.

**Tech Stack:** TypeScript (tsx), existing soap-generator + tx-sequence-engine, PRNG (mulberry32)

## Tasks: 1-patient-randomizer, 2-generation-script, 3-tmux-launcher, 4-validation, 5-gitignore
