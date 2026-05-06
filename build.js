#!/usr/bin/env node
/**
 * Build script for the Training Program site.
 *
 *   node build.js          → regenerates notes-index.json from notes/
 *   node build.js --sync   → first copies roster.json + notes/*.md from
 *                            ../  (the source wrestling-training folder),
 *                            then regenerates the index
 *
 * The script has zero npm dependencies — only Node's built-in modules.
 */

const fs = require('fs');
const path = require('path');

const SITE_DIR = __dirname;
const NOTES_DIR = path.join(SITE_DIR, 'notes');
const INDEX_FILE = path.join(SITE_DIR, 'notes-index.json');

const SRC_DIR = path.resolve(SITE_DIR, '..');
const SRC_ROSTER = path.join(SRC_DIR, 'roster.json');
const SRC_NOTES = path.join(SRC_DIR, 'notes');

const args = process.argv.slice(2);
const doSync = args.includes('--sync');

function syncFromSource() {
  if (!fs.existsSync(SRC_ROSTER) || !fs.existsSync(SRC_NOTES)) {
    console.warn('No source roster.json/notes/ found at', SRC_DIR, '— skipping sync.');
    return;
  }
  fs.copyFileSync(SRC_ROSTER, path.join(SITE_DIR, 'roster.json'));
  console.log('Synced roster.json');

  if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });
  const srcFiles = fs.readdirSync(SRC_NOTES).filter(f => f.endsWith('.md'));
  for (const f of srcFiles) {
    fs.copyFileSync(path.join(SRC_NOTES, f), path.join(NOTES_DIR, f));
  }
  console.log(`Synced ${srcFiles.length} note file${srcFiles.length === 1 ? '' : 's'}`);
}

function extractAttendees(md) {
  // Matches "**Attendees**: Name 1, Name 2, ..."
  const m = md.match(/\*\*Attendees\*\*:\s*([^\n]+)/);
  if (!m) return [];
  return m[1]
    .split(',')
    .map(s => s.trim().replace(/\*+$/, '').replace(/^\*+/, ''))
    .filter(Boolean);
}

function buildIndex() {
  if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
  }
  const files = fs.readdirSync(NOTES_DIR).filter(f => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f));
  const sessions = files.map(f => {
    const md = fs.readFileSync(path.join(NOTES_DIR, f), 'utf8');
    return {
      date: f.replace(/\.md$/, ''),
      attendees: extractAttendees(md)
    };
  }).sort((a, b) => b.date.localeCompare(a.date));

  const lastUpdated = sessions[0]?.date.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || null;
  const out = { last_updated: lastUpdated, sessions };
  fs.writeFileSync(INDEX_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote notes-index.json (${sessions.length} session${sessions.length === 1 ? '' : 's'})`);
}

if (doSync) syncFromSource();
buildIndex();
