import { logEntriesRepo } from '../data/logEntriesRepo';
import { settingsRepo } from '../data/settingsRepo';
import { htmlToMarkdown } from './htmlToMarkdown';

const FLAG_KEY = 'content_format';
const FLAG_VALUE = 'markdown';

/**
 * One-time migration: convert legacy HTML in `log_entries.formatted_text` to
 * Markdown. Guarded by the `content_format=markdown` setting so it runs once and
 * is idempotent. Non-blocking: failures are logged and retried next launch.
 */
export async function runContentMigration(): Promise<void> {
  try {
    if ((await settingsRepo.get(FLAG_KEY)) === FLAG_VALUE) return;

    const entries = await logEntriesRepo.listAll();
    for (const entry of entries) {
      const markdown = htmlToMarkdown(entry.formatted_text);
      if (markdown !== entry.formatted_text) {
        await logEntriesRepo.update(entry.id, entry.raw_text, markdown);
      }
    }

    await settingsRepo.set(FLAG_KEY, FLAG_VALUE);
  } catch (err) {
    console.error('Content HTML→Markdown migration failed; will retry next launch:', err);
  }
}
