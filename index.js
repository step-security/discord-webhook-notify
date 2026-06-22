const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const axios = require('axios');

const webhook = require("webhook-discord");

async function validateSubscription() {
  let repoPrivate;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    repoPrivate = payload?.repository?.private;
  }

  const upstream = 'n0-computer/discord-webhook-notify';
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const docsUrl = 'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions';
  core.info('');
  core.info('\u001b[1;36mStepSecurity Maintained Action\u001b[0m');
  core.info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false) core.info('\u001b[32m\u2713 Free for public repositories\u001b[0m');
  core.info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`);
  core.info('');
  if (repoPrivate === false) return;
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const body = { action: action || '' };
  if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl;
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body, { timeout: 3000 }
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      core.error(`\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`);
      core.error(`\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`);
      process.exit(1);
    }
    core.info('Timeout or API not reachable. Continuing to next step.');
  }
}

const default_avatarUrl = "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";
const default_username = "GitHub";
const default_colors = {
    info: '#00ff00',
    warn: '#ff9900',
    error: '#ff0000'
}
const long_severity = {
    info: "Informational",
    warn: "Warning",
    error: "Error"
}

async function getDefaultDescription() {
    const context = github.context;
    const payload = context.payload;

    switch(github.context.eventName) {
    case 'push':
        return `- **Event:** ${context.eventName}\n`
            + `- **Repo:** ${payload.repository.full_name}\n`
            + `- **Ref:** ${payload.ref}\n`
            + `- **Workflow:** ${context.workflow}\n`
            + `- **Author:** ${payload.head_commit.author.name}\n`
            + `- **Committer:** ${payload.head_commit.committer.name}\n`
            + `- **Pusher:** ${payload.pusher.name}\n`
            + `- **Commit URL:** ${payload.head_commit.url}\n`
            + `- **Commit Message:** ${payload.head_commit.message}\n`
            ;
    case 'release':
        return `- **Event:** ${context.eventName}\n`
            + `- **Repo:** ${payload.repository.full_name}\n`
            + `- **Action:** ${payload.action}\n`
            + `- **Name**: ${payload.release.name}\n`
            + `- **Author:** ${payload.release.author.login}\n`
            + `- **Tag:** ${payload.release.tag_name}`
            + payload.release.prerelease ? ' (pre-release)' : ''
            + '\n'
            + `- **Url:** ${payload.release.url}`
            ;
    case 'schedule':
        return `- **Event:** ${context.eventName}\n`
            + `- **Ref**: ${context.ref}\n`
            + `- **Workflow**: ${context.workflow}\n`
            + `- **Commit SHA**: ${context.sha}\n`
            ;
    default:
        return `- **Event:** ${context.eventName}\n`
            + `- **Repo:** ${payload.repository.full_name}\n`;
    }
}

async function run() {
    await validateSubscription();
    try {
        const webhookUrl = core.getInput('webhookUrl').replace("/github", "");
        if (!webhookUrl) {
            core.setFailed("The webhookUrl was not provided. For security reasons the secret URL must be provided "
                           + "in the action yaml using a context expression and can not be read as a default.");
            return;
        }
        const severity = core.getInput('severity');
        const description = core.getInput('description');
        const details = core.getInput('details');
        const footer = core.getInput('footer');
        const text = core.getInput('text');
        const username = core.getInput('username');
        const color = core.getInput('color');
        const avatarUrl = core.getInput('avatarUrl');
        
        const context = github.context;
        const obstr = JSON.stringify(context, undefined, 2)
        core.debug(`The event github.context: ${obstr}`);

        const hook = new webhook.Webhook(webhookUrl);

        core.info(`${username} ${avatarUrl} ${color} ${description} ${details} ${footer} ${text}`)

        const msg = new webhook.MessageBuilder()
                        .setName(username || default_username)
                        .setAvatar(avatarUrl || default_avatarUrl)
                        .setColor(color || default_colors[severity])
                        .setDescription((description || await getDefaultDescription()) + "\n" + details)
                        .setFooter(footer || ("Severity: " + long_severity[severity]))
                        .setText(text)
                        .setTime();

        hook.send(msg);

    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
