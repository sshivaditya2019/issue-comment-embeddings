import { Context } from "../types";
import { removeFootnotes } from "./issue-deduplication";

export async function addIssue(context: Context<"issues.opened">) {
  const {
    logger,
    adapters: { supabase },
    payload,
  } = context;
  const issue = payload.issue;
  const isPrivate = payload.repository.private;
  const redactPrivateRepoComments = context.pluginConfig?.redactPrivateRepoComments ?? false;
  let markdown = payload.issue.body && payload.issue.title ? `${payload.issue.body} ${payload.issue.title}` : null;

  if (isPrivate && redactPrivateRepoComments && markdown) {
    // Keep the title but redact the body
    markdown = `[REDACTED] ${payload.issue.title}`;
    logger.info('Content redacted due to private repository setting');
  }
  const authorId = issue.user?.id || -1;
  const id = issue.node_id;
  const isPrivate = payload.repository.private;

  try {
    if (!markdown) {
      logger.error("Issue body is empty", { issue });
      return;
    }

    let issueContent = removeFootnotes(markdown);
    if (isPrivate && context.settings.redactPrivateRepoComments) {
      logger.info("Redacting issue content for private repository");
      // Preserve the title but redact the body
      const title = payload.issue.title;
      issueContent = `${title}\n\n[REDACTED]`;
    }

    await supabase.issue.createIssue({ 
      id, 
      payload, 
      isPrivate, 
      markdown: issueContent, 
      author_id: authorId 
    });
    logger.ok(`Successfully created issue!`, issue);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error creating issue:`, { error: error, issue: issue });
      throw error;
    } else {
      logger.error(`Error creating issue:`, { err: error, issue: issue });
      throw error;
    }
  }
  logger.debug(`Exiting addIssue`);
}
