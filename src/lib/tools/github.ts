import { tool } from "ai";
import { z } from "zod";

const DEMO_MODE = process.env.DEMO_MODE !== "false";

// --- Mock implementations ---------------------------------------------------

function mockListRepositories() {
  return tool({
    description: "List repositories for the authenticated GitHub user",
    inputSchema: z.object({}),
    execute: async () => ({
      total: 5,
      repositories: [
        {
          name: "agentgate",
          full_name: "demo-user/agentgate",
          description: "Permission Contracts for AI Agents",
          private: false,
          html_url: "https://github.com/demo-user/agentgate",
          language: "TypeScript",
          stars: 42,
          updated_at: new Date().toISOString(),
        },
        {
          name: "my-saas-app",
          full_name: "demo-user/my-saas-app",
          description: "A Next.js SaaS boilerplate",
          private: true,
          html_url: "https://github.com/demo-user/my-saas-app",
          language: "TypeScript",
          stars: 12,
          updated_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          name: "dotfiles",
          full_name: "demo-user/dotfiles",
          description: "My dev environment configuration",
          private: false,
          html_url: "https://github.com/demo-user/dotfiles",
          language: "Shell",
          stars: 3,
          updated_at: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          name: "ml-experiments",
          full_name: "demo-user/ml-experiments",
          description: "Machine learning notebooks and scripts",
          private: true,
          html_url: "https://github.com/demo-user/ml-experiments",
          language: "Python",
          stars: 0,
          updated_at: new Date(Date.now() - 604800000).toISOString(),
        },
        {
          name: "blog",
          full_name: "demo-user/blog",
          description: "Personal blog built with Astro",
          private: false,
          html_url: "https://github.com/demo-user/blog",
          language: "Astro",
          stars: 8,
          updated_at: new Date(Date.now() - 1209600000).toISOString(),
        },
      ],
    }),
  });
}

function mockListPullRequests() {
  return tool({
    description: "List open pull requests for a GitHub repository",
    inputSchema: z.object({
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
    }),
    execute: async ({ owner, repo }) => ({
      total: 2,
      pull_requests: [
        {
          number: 23,
          title: "feat: add dark mode support",
          state: "open",
          user: "alice-dev",
          html_url: `https://github.com/${owner}/${repo}/pull/23`,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          head_branch: "feature/dark-mode",
          base_branch: "main",
        },
        {
          number: 21,
          title: "fix: resolve auth token refresh race condition",
          state: "open",
          user: "bob-dev",
          html_url: `https://github.com/${owner}/${repo}/pull/21`,
          created_at: new Date(Date.now() - 259200000).toISOString(),
          head_branch: "fix/token-refresh",
          base_branch: "main",
        },
      ],
    }),
  });
}

function mockPostPRComment() {
  return tool({
    description:
      "Post a comment on a GitHub pull request. Requires user approval per contract.",
    inputSchema: z.object({
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      pull_number: z.number().describe("Pull request number"),
      body: z.string().describe("The comment text to post"),
    }),
    execute: async ({ owner, repo, pull_number, body }) => ({
      id: Date.now(),
      html_url: `https://github.com/${owner}/${repo}/pull/${pull_number}#issuecomment-${Date.now()}`,
      created_at: new Date().toISOString(),
      body,
    }),
  });
}

function mockMergePullRequest() {
  return tool({
    description: "Merge a GitHub pull request",
    inputSchema: z.object({
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      pull_number: z.number().describe("Pull request number"),
    }),
    execute: async ({ owner, repo, pull_number }) => ({
      merged: true,
      message: `Pull request #${pull_number} on ${owner}/${repo} has been merged.`,
    }),
  });
}

// --- Real implementations (Token Vault + GitHub API) -------------------------

function realListRepositories() {
  const { Octokit, RequestError } = require("octokit");
  const { TokenVaultError } = require("@auth0/ai/interrupts");
  const { getAccessToken, withGitHubConnection } = require("../auth0-ai");

  return withGitHubConnection(
    tool({
      description: "List repositories for the authenticated GitHub user",
      inputSchema: z.object({}),
      execute: async () => {
        const accessToken = await getAccessToken();
        try {
          const octokit = new Octokit({ auth: accessToken });
          const { data } = await octokit.rest.repos.listForAuthenticatedUser({
            visibility: "all",
            sort: "updated",
            per_page: 15,
          });
          return {
            total: data.length,
            repositories: data.map((repo: any) => ({
              name: repo.name,
              full_name: repo.full_name,
              description: repo.description,
              private: repo.private,
              html_url: repo.html_url,
              language: repo.language,
              stars: repo.stargazers_count,
              updated_at: repo.updated_at,
            })),
          };
        } catch (error: any) {
          if (error instanceof RequestError && error.status === 401) {
            throw new TokenVaultError("Authorization required for GitHub.");
          }
          throw error;
        }
      },
    })
  );
}

function realListPullRequests() {
  const { Octokit, RequestError } = require("octokit");
  const { TokenVaultError } = require("@auth0/ai/interrupts");
  const { getAccessToken, withGitHubConnection } = require("../auth0-ai");

  return withGitHubConnection(
    tool({
      description: "List open pull requests for a GitHub repository",
      inputSchema: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
      }),
      execute: async ({ owner, repo }: { owner: string; repo: string }) => {
        const accessToken = await getAccessToken();
        try {
          const octokit = new Octokit({ auth: accessToken });
          const { data } = await octokit.rest.pulls.list({
            owner,
            repo,
            state: "open",
            per_page: 10,
          });
          return {
            total: data.length,
            pull_requests: data.map((pr: any) => ({
              number: pr.number,
              title: pr.title,
              state: pr.state,
              user: pr.user?.login,
              html_url: pr.html_url,
              created_at: pr.created_at,
              head_branch: pr.head.ref,
              base_branch: pr.base.ref,
            })),
          };
        } catch (error: any) {
          if (error instanceof RequestError && error.status === 401) {
            throw new TokenVaultError("Authorization required for GitHub.");
          }
          throw error;
        }
      },
    })
  );
}

function realPostPRComment() {
  const { Octokit, RequestError } = require("octokit");
  const { TokenVaultError } = require("@auth0/ai/interrupts");
  const { getAccessToken, withGitHubConnection } = require("../auth0-ai");

  return withGitHubConnection(
    tool({
      description:
        "Post a comment on a GitHub pull request. Requires user approval per contract.",
      inputSchema: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        pull_number: z.number().describe("Pull request number"),
        body: z.string().describe("The comment text to post"),
      }),
      execute: async ({
        owner,
        repo,
        pull_number,
        body,
      }: {
        owner: string;
        repo: string;
        pull_number: number;
        body: string;
      }) => {
        const accessToken = await getAccessToken();
        try {
          const octokit = new Octokit({ auth: accessToken });
          const { data } = await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body,
          });
          return {
            id: data.id,
            html_url: data.html_url,
            created_at: data.created_at,
          };
        } catch (error: any) {
          if (error instanceof RequestError && error.status === 401) {
            throw new TokenVaultError("Authorization required for GitHub.");
          }
          throw error;
        }
      },
    })
  );
}

function realMergePullRequest() {
  const { Octokit, RequestError } = require("octokit");
  const { TokenVaultError } = require("@auth0/ai/interrupts");
  const { getAccessToken, withGitHubConnection } = require("../auth0-ai");

  return withGitHubConnection(
    tool({
      description: "Merge a GitHub pull request",
      inputSchema: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        pull_number: z.number().describe("Pull request number"),
      }),
      execute: async ({
        owner,
        repo,
        pull_number,
      }: {
        owner: string;
        repo: string;
        pull_number: number;
      }) => {
        const accessToken = await getAccessToken();
        try {
          const octokit = new Octokit({ auth: accessToken });
          const { data } = await octokit.rest.pulls.merge({
            owner,
            repo,
            pull_number,
          });
          return { merged: data.merged, message: data.message };
        } catch (error: any) {
          if (error instanceof RequestError && error.status === 401) {
            throw new TokenVaultError("Authorization required for GitHub.");
          }
          throw error;
        }
      },
    })
  );
}

// --- Exports ----------------------------------------------------------------

export const listRepositories = DEMO_MODE
  ? mockListRepositories()
  : realListRepositories();

export const listPullRequests = DEMO_MODE
  ? mockListPullRequests()
  : realListPullRequests();

export const postPRComment = DEMO_MODE
  ? mockPostPRComment()
  : realPostPRComment();

export const mergePullRequest = DEMO_MODE
  ? mockMergePullRequest()
  : realMergePullRequest();
