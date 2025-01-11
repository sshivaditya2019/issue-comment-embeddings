import { Context } from "../types";
import { addIssue } from "./add-issue";

export async function addComments(context: Context<"issue_comment.created">) {
  const {
    logger,
    adapters: { supabase },
    payload,
  } = context;
  const comment = payload.comment;
  const isPrivate = payload.repository.private;
  const redactPrivateRepoComments = context.pluginConfig?.redactPrivateRepoComments ?? false;
  let markdown = comment.body;
  
  if (isPrivate && redactPrivateRepoComments && markdown) {
    markdown = '[REDACTED]';
    logger.info('Content redacted due to private repository setting');
  }
  const authorId = comment.user?.id || -1;
  const id = comment.node_id;
  const isPrivate = payload.repository.private;
  const issueId = payload.issue.node_id;

  try {
    if (!markdown) {
      logger.error("Comment body is empty");
      return;
    }
    if (context.payload.issue.pull_request) {
      logger.error("Comment is on a pull request");
      return;
    }
    if ((await supabase.issue.getIssue(issueId)) === null) {
      logger.info("Parent issue not found, creating new issue", { "Issue ID": issueId });
      await addIssue(context as unknown as Context<"issues.opened">);
    }

    let commentMarkdown = markdown;
    if (isPrivate && context.settings.redactPrivateRepoComments) {
      logger.info("Redacting comment content for private repository");
      commentMarkdown = "[REDACTED]";
    }

    await supabase.comment.createComment({ 
      markdown: commentMarkdown, 
      id, 
      author_id: authorId, 
      payload, 
      isPrivate, 
      issue_id: issueId 
    });
    logger.ok(`Successfully created comment!`, comment);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error creating comment:`, { error: error, stack: error.stack, comment: comment });
    } else {
      logger.error(`Error creating comment:`, { err: error, comment: comment });
    }
  }
  logger.debug(`Exiting addComments`);
}
